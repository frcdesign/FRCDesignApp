/**
 * Rebuilds `daily_configuration_metrics` from the event log, keying every count
 * by the branch it was chosen in. One-off: rows written before migration 0004
 * carry no key, and only the log still says which branch they belong to.
 *
 *     npx tsx scripts/rebuild-configuration-metrics.ts --env cert --out out/config-metrics.sql
 *     npx wrangler d1 execute DB --env cert --remote --file=out/config-metrics.sql
 *
 * `--local` in place of `--env <name>` reads the local dev database instead;
 * apply the file with `--local` too.
 *
 * Run it on any day after the deploy carrying 0004. It rewrites the days up to
 * yesterday (`--through` to choose another), leaving today to the live write
 * path — which by then keys what it writes, and which a rewrite of a day still
 * being recorded would drop inserts from.
 *
 * Before writing anything it checks the log accounts for every count in the
 * table: the rebuild replaces those rows outright, so a count the log cannot
 * reproduce would be lost rather than re-keyed. On a mismatch it stops, unless
 * `--allow-mismatch` says to write the file anyway.
 *
 * The file begins by clearing the days it rewrites, so applying it again after
 * a failure part-way is safe.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type {
    ConfigurationParameter,
    Selection
} from "../src/backend/features/configurations/contract";
import { toInstanceKeys } from "../src/backend/features/configurations/instances";
import { toReportingDay } from "../src/backend/features/analytics/day";

interface Args {
    /** Wrangler's flags for the database to read. */
    target: string[];
    label: string;
    out: string;
    through: string;
    allowMismatch: boolean;
}

const parseArgs = (argv: string[]): Args => {
    const values: Record<string, string> = {};
    const flags = new Set<string>();
    for (let i = 0; i < argv.length; i++) {
        const name = argv[i].replace(/^--/, "");
        if (name === "local" || name === "allow-mismatch") {
            flags.add(name);
        } else {
            values[name] = argv[++i];
        }
    }
    if (!flags.has("local") && !values.env) {
        throw new Error("pass --env <name>, or --local");
    }
    if (!values.out) throw new Error("missing --out");
    return {
        target: flags.has("local")
            ? ["--local"]
            : ["--env", values.env, "--remote"],
        label: flags.has("local") ? "local" : values.env,
        out: values.out,
        through: values.through ?? toReportingDay(Date.now()),
        allowMismatch: flags.has("allow-mismatch")
    };
};

/** One read against the target database, as rows. */
const query = <T>(args: Args, sql: string): T[] => {
    const out = execFileSync(
        "npx",
        [
            "wrangler",
            "d1",
            "execute",
            "DB",
            ...args.target,
            "--json",
            "--command",
            sql
        ],
        { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
    );
    return (JSON.parse(out) as { results: T[] }[])[0].results;
};

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
};

/** Events per read: a page is one wrangler call, and a season is many pages. */
const PAGE = 2000;

/**
 * D1 caps one statement at 100 KB, and a free-form value is whatever someone
 * typed, so inserts are cut by size rather than by a row count.
 * https://developers.cloudflare.com/d1/platform/limits/
 */
const MAX_STATEMENT_BYTES = 90_000;

interface LoggedInsert {
    id: string;
    day: string;
    library_id: string;
    element_id: string;
    selection: string;
}

/**
 * Every insert up to `through` that applied a configuration. The filter is
 * `asInsert`'s, spelled in SQL: those are the only rows the live write path
 * counts, so they are the only ones a replay may.
 */
const readLog = (args: Args): LoggedInsert[] => {
    const inserts: LoggedInsert[] = [];
    // Paged on (day, id): the day index carries the range, and the id breaks
    // the tie so a day spanning two pages resumes rather than repeats.
    let after = { day: "", id: "" };
    for (;;) {
        const page = query<LoggedInsert>(
            args,
            `SELECT id, day, library_id, element_id, selection FROM events
             WHERE type = 'insert'
               AND element_id IS NOT NULL
               AND target_element_type IS NOT NULL
               AND source IS NOT NULL
               AND selection IS NOT NULL
               AND day <= ${sqlString(args.through)}
               AND (day, id) > (${sqlString(after.day)}, ${sqlString(after.id)})
             ORDER BY day, id
             LIMIT ${PAGE}`
        );
        if (page.length === 0) return inserts;
        inserts.push(...page);
        const last = page[page.length - 1];
        after = { day: last.day, id: last.id };
        process.stdout.write(`\rread ${inserts.length} inserts`);
    }
};

/**
 * The parameters each part in the log declares now, keyed `<library>|<element>`.
 * Read in slices, as the favorites migration does: parameters are large. A part
 * that has left the library has none, which keys its values as branchless — the
 * same thing the report does with a parameter it can no longer see.
 */
const readParameters = (
    args: Args,
    inserts: LoggedInsert[]
): Map<string, ConfigurationParameter[]> => {
    const elements = [...new Set(inserts.map((row) => row.element_id))];
    const parameters = new Map<string, ConfigurationParameter[]>();
    for (const ids of chunk(elements, 100)) {
        const rows = query<{
            library_id: string;
            element_id: string;
            parameters: string;
        }>(
            args,
            `SELECT i.library_id, i.element_id, c.parameters
             FROM insertables i
             JOIN configurations c ON c.insertable_id = i.id
             WHERE i.element_id IN (${ids.map(sqlString).join(", ")})`
        );
        for (const row of rows) {
            parameters.set(
                `${row.library_id}|${row.element_id}`,
                JSON.parse(row.parameters) as ConfigurationParameter[]
            );
        }
    }
    return parameters;
};

/** A rebuilt row, keyed as the table keys it. */
type RowKey = [
    day: string,
    libraryId: string,
    elementId: string,
    parameterId: string,
    value: string,
    instanceKey: string
];

/** The key with the branch dropped, which is what the old table can check. */
const unkeyed = ([, libraryId, elementId, parameterId, value]: RowKey) =>
    JSON.stringify([libraryId, elementId, parameterId, value]);

/**
 * The counts the rollup would hold had every insert been keyed as it happened.
 * `toInstanceKeys` is the live write path's own, so the two cannot disagree.
 */
const recount = (
    inserts: LoggedInsert[],
    parameters: Map<string, ConfigurationParameter[]>
): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const insert of inserts) {
        const selection = JSON.parse(insert.selection) as Selection;
        const keys = toInstanceKeys(
            selection,
            parameters.get(`${insert.library_id}|${insert.element_id}`) ?? []
        );
        for (const [parameterId, value] of Object.entries(selection)) {
            const key: RowKey = [
                insert.day,
                insert.library_id,
                insert.element_id,
                parameterId,
                value,
                keys[parameterId] ?? ""
            ];
            const text = JSON.stringify(key);
            counts.set(text, (counts.get(text) ?? 0) + 1);
        }
    }
    return counts;
};

/**
 * Where the table and the log disagree on a value's total. The branch is
 * ignored on both sides: the table has none to compare, and the totals are
 * what a rebuild must keep.
 */
const findMismatches = (
    args: Args,
    counts: Map<string, number>
): { key: string; table: number; log: number }[] => {
    const fromLog = new Map<string, number>();
    for (const [text, count] of counts) {
        const key = unkeyed(JSON.parse(text) as RowKey);
        fromLog.set(key, (fromLog.get(key) ?? 0) + count);
    }

    const fromTable = new Map<string, number>();
    for (const row of query<{
        library_id: string;
        element_id: string;
        parameter_id: string;
        value: string;
        count: number;
    }>(
        args,
        `SELECT library_id, element_id, parameter_id, value, SUM(count) AS count
         FROM daily_configuration_metrics
         WHERE day <= ${sqlString(args.through)}
         GROUP BY library_id, element_id, parameter_id, value`
    )) {
        fromTable.set(
            JSON.stringify([
                row.library_id,
                row.element_id,
                row.parameter_id,
                row.value
            ]),
            row.count
        );
    }

    const mismatches = [];
    for (const key of new Set([...fromLog.keys(), ...fromTable.keys()])) {
        const table = fromTable.get(key) ?? 0;
        const log = fromLog.get(key) ?? 0;
        if (table !== log) mismatches.push({ key, table, log });
    }
    return mismatches;
};

const toStatements = (args: Args, counts: Map<string, number>): string[] => {
    const statements = [
        [
            "-- daily_configuration_metrics, rebuilt from the event log.",
            "-- Generated by scripts/rebuild-configuration-metrics.ts; do not edit.",
            `-- Target: ${args.label}, through ${args.through}`
        ].join("\n"),
        `DELETE FROM daily_configuration_metrics WHERE day <= ${sqlString(args.through)};`
    ];

    // Sorted, so the same log writes the same file and two runs can be diffed.
    const rows = [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([text, count]) => {
            const key = JSON.parse(text) as RowKey;
            return `  (${[...key.map(sqlString), String(count)].join(", ")})`;
        });

    const head =
        "INSERT INTO daily_configuration_metrics\n" +
        "  (day, library_id, element_id, parameter_id, value, instance_key, count)\n" +
        "VALUES\n";
    let batch: string[] = [];
    let bytes = head.length;
    const flush = () => {
        if (batch.length === 0) return;
        statements.push(head + batch.join(",\n") + ";");
        batch = [];
        bytes = head.length;
    };
    for (const row of rows) {
        if (bytes + row.length + 2 > MAX_STATEMENT_BYTES) flush();
        batch.push(row);
        bytes += row.length + 2;
    }
    flush();
    return statements;
};

const main = () => {
    const args = parseArgs(process.argv.slice(2));

    const inserts = readLog(args);
    console.log(`\rread ${inserts.length} inserts through ${args.through}`);
    const counts = recount(inserts, readParameters(args, inserts));

    const mismatches = findMismatches(args, counts);
    if (mismatches.length > 0) {
        console.log(
            `\n${mismatches.length} values where the table and the log disagree:`
        );
        for (const { key, table, log } of mismatches.slice(0, 20)) {
            console.log(`  ${key}  table ${table}, log ${log}`);
        }
        if (mismatches.length > 20) {
            console.log(`  … and ${mismatches.length - 20} more`);
        }
        if (!args.allowMismatch) {
            console.log(
                "\nNothing written. The rebuild replaces these rows, so the" +
                    " table's counts would be lost. Pass --allow-mismatch to" +
                    " write the file anyway."
            );
            process.exit(1);
        }
    } else {
        console.log("the log accounts for every count in the table");
    }

    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, toStatements(args, counts).join("\n\n") + "\n");

    const branched = [...counts.keys()].filter(
        (text) => (JSON.parse(text) as RowKey)[5] !== ""
    ).length;
    console.log(`rows:          ${counts.size}`);
    console.log(`  with a branch: ${branched}`);
    console.log(`\nwrote ${args.out}`);
};

main();
