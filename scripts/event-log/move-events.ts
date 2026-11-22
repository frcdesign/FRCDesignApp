/**
 * Moves an environment's D1 `events` into its event log stream, and fills
 * `daily_feature_users` from them as live tracking would. Pages by rowid and
 * prints each page's last one: on a failure, resume with `--after` it. See
 * README.md.
 */
import { parseArgs } from "node:util";
import { getTableColumns } from "drizzle-orm";
import {
    events,
    type LoggedEvent
} from "../../src/backend/features/analytics/schema";
import { toLogRecord } from "../../src/backend/features/analytics/event-log";
import { featuresOf } from "../../src/backend/features/analytics/feature-reach";

const { values: args } = parseArgs({
    options: {
        database: { type: "string" },
        stream: { type: "string" },
        after: { type: "string", default: "0" },
        "page-size": { type: "string", default: "2000" }
    }
});
const accountId = required(
    process.env.CLOUDFLARE_ACCOUNT_ID,
    "CLOUDFLARE_ACCOUNT_ID"
);
const apiToken = required(
    process.env.CLOUDFLARE_API_TOKEN,
    "CLOUDFLARE_API_TOKEN"
);
const pipelineToken = required(process.env.PIPELINE_TOKEN, "PIPELINE_TOKEN");
const database = required(args.database, "--database");
const stream = required(args.stream, "--stream");
const pageSize = Number(args["page-size"]);

/** Feature rows per INSERT: well under D1's statement size. */
const FEATURE_ROWS_PER_STATEMENT = 500;

function required(value: string | undefined, name: string): string {
    if (!value) throw new Error(`${name} is required`);
    return value;
}

type Row = Record<string, unknown>;

async function query(sql: string, params: unknown[] = []): Promise<Row[]> {
    const res = await withRetries(() =>
        fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${database}/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ sql, params })
            }
        )
    );
    const body = (await res.json()) as {
        success: boolean;
        errors: unknown[];
        result: { results: Row[] }[];
    };
    if (!body.success) throw new Error(JSON.stringify(body.errors));
    return body.result.flatMap((r) => r.results);
}

/** Retries what a later try can fix: rate limits and server errors. */
async function withRetries(send: () => Promise<Response>): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        const res = await send();
        const retryable = res.status === 429 || res.status >= 500;
        if (res.ok || !retryable || attempt === 5) {
            if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
            return res;
        }
        await new Promise((resolve) =>
            setTimeout(resolve, 2 ** attempt * 1000)
        );
    }
}

/** A D1 row as Drizzle reads it, so the record matches what tracking sends. */
function toLoggedEvent(row: Row): LoggedEvent {
    const event: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(getTableColumns(events))) {
        const raw = row[column.name];
        event[key] =
            raw === null || raw === undefined
                ? null
                : column.mapFromDriverValue(raw);
    }
    return event as LoggedEvent;
}

async function send(logged: LoggedEvent[]): Promise<void> {
    await withRetries(() =>
        fetch(`https://${stream}.ingest.cloudflare.com`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${pipelineToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(logged.map(toLogRecord))
        })
    );
}

function quote(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
}

async function markFeatureUsers(logged: LoggedEvent[]): Promise<number> {
    const rows = new Set<string>();
    for (const event of logged) {
        for (const feature of featuresOf(event)) {
            rows.add(
                `(${quote(event.day)}, ${quote(feature)}, ${quote(event.userId)})`
            );
        }
    }
    const values = [...rows];
    for (let i = 0; i < values.length; i += FEATURE_ROWS_PER_STATEMENT) {
        const chunk = values.slice(i, i + FEATURE_ROWS_PER_STATEMENT);
        await query(
            `INSERT OR IGNORE INTO daily_feature_users (day, feature, user_id) VALUES ${chunk.join(", ")}`
        );
    }
    return values.length;
}

let after = Number(args.after);
let moved = 0;
for (;;) {
    const rows = await query(
        "SELECT rowid AS _rowid, * FROM events WHERE rowid > ? ORDER BY rowid LIMIT ?",
        [after, pageSize]
    );
    if (rows.length === 0) break;
    const logged = rows.map(toLoggedEvent);
    await send(logged);
    const featureRows = await markFeatureUsers(logged);
    moved += rows.length;
    after = Number(rows[rows.length - 1]._rowid);
    console.log(
        `moved ${moved} events through rowid ${after} (${featureRows} feature rows)`
    );
}
console.log(`done: ${moved} events`);
