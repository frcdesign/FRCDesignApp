/**
 * Turns the legacy app's log (`export.py`) into SQL that adds it to a D1
 * database's analytics, as if the live write path had recorded every row.
 *
 *     npx tsx scripts/migrate-analytics/build-sql.ts \
 *         --events out/legacy-events.jsonl --env production --out out/analytics
 *     for f in out/analytics/*.sql; do
 *         npx wrangler d1 execute DB --env production --remote --yes --file="$f" || break
 *     done
 *
 * `--local` in place of `--env <name>` reads the local dev database; apply the
 * files with `--local` too. See README.md beside this file.
 */
import { execFileSync } from "node:child_process";
import {
    closeSync,
    createReadStream,
    mkdirSync,
    openSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeSync
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
    DatabaseSync,
    type SQLInputValue,
    type SQLOutputValue
} from "node:sqlite";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

import { getDb } from "../../src/backend/db/client";
import {
    dailyAppOpens,
    dailyConfigurationMetrics,
    dailyInsertableMetrics,
    dailyInsertableUsers,
    dailyMetrics,
    dailySourceMetrics,
    dailyTargetMetrics,
    dailyUserActivity,
    events,
    insertableStats,
    userStats,
    type LoggedEvent
} from "../../src/backend/features/analytics/schema";
import { rollupWrites } from "../../src/backend/features/analytics/rollups";
import {
    NO_ELEMENT,
    NOT_A_REPORT,
    NOT_A_USE,
    NOT_A_VERSION_RUN
} from "../../src/backend/features/analytics/logged-event";
import { toDayKey } from "../../src/backend/features/analytics/day";
import {
    EventType,
    LEGACY_SCHEMA_VERSION,
    UseSource
} from "../../src/backend/features/analytics/usage";
import {
    ParameterType,
    type ConfigurationParameter,
    type Selection
} from "../../src/backend/features/configurations/contract";
import { canonicalValues } from "../../src/backend/features/configurations/selection";
import { LibraryId } from "../../src/backend/features/library/library-id";
import { ElementType } from "../../src/backend/lib/onshape/element-type";

interface Args {
    /** Wrangler's flags for the database to read. */
    target: string[];
    events: string;
    out: string;
    maxEventsPerFile: number;
}

const parseArgs = (argv: string[]): Args => {
    const values: Record<string, string> = {};
    let local = false;
    for (let i = 0; i < argv.length; i++) {
        const name = argv[i].replace(/^--/, "");
        if (name === "local") local = true;
        else values[name] = argv[++i];
    }
    if (!local && !values.env) throw new Error("pass --env <name>, or --local");
    if (!values.events) throw new Error("missing --events");
    if (!values.out) throw new Error("missing --out");
    return {
        target: local ? ["--local"] : ["--env", values.env, "--remote"],
        events: values.events,
        out: values.out,
        maxEventsPerFile: Number(values["max-events"] ?? 100_000)
    };
};

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
        { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
    );
    return (JSON.parse(out) as { results: T[] }[])[0].results;
};

/** One line of `export.py`'s output; every value is BigQuery's string or null. */
interface LegacyRow {
    id: string;
    created_at: string;
    message: "Part inserted" | "App opened";
    user_id: string | null;
    library: string | null;
    element_id: string | null;
    /** The part's name when it was inserted. */
    name: string | null;
    version_id: string | null;
    target: string | null;
    is_favorite: string | null;
    quick_insert: string | null;
    fasten: string | null;
    /** A JSON array of `{ id, type, value }`; an enum's value is its option's name. */
    configuration: string | null;
}

interface LoggedValue {
    id: string;
    name: string | null;
    type: string;
    value: string | null;
}

interface Insertable {
    id: string;
    libraryId: LibraryId;
    elementId: string;
    name: string;
    documentId: string;
    parameters: ConfigurationParameter[];
}

/** By `library:element`, since a document shared by two libraries puts one element behind two insertables. */
type Insertables = Map<string, Insertable>;

const insertableKey = (libraryId: string, elementId: string) =>
    `${libraryId}:${elementId}`;

const INSERTABLE_PAGE = 100;

const readInsertables = (args: Args): Insertables => {
    const found: Insertables = new Map();
    let after = "";
    for (;;) {
        const page = query<{
            id: string;
            library_id: LibraryId;
            element_id: string;
            name: string;
            document_id: string;
            parameters: string | null;
        }>(
            args,
            `SELECT i.id, i.library_id, i.element_id, i.name, i.document_id, c.parameters
             FROM insertables i LEFT JOIN configurations c ON c.insertable_id = i.id
             WHERE i.id > '${after}' ORDER BY i.id LIMIT ${INSERTABLE_PAGE}`
        );
        for (const row of page) {
            found.set(insertableKey(row.library_id, row.element_id), {
                id: row.id,
                libraryId: row.library_id,
                elementId: row.element_id,
                name: row.name,
                documentId: row.document_id,
                parameters: row.parameters
                    ? (JSON.parse(row.parameters) as ConfigurationParameter[])
                    : []
            });
        }
        if (page.length < INSERTABLE_PAGE) return found;
        after = page[page.length - 1].id;
    }
};

const LIBRARY_IDS = new Set<string>(Object.values(LibraryId));

/**
 * The library a row names. The first weeks of the log predate the field, when
 * the app served one library; an element now in exactly one library says which.
 */
const libraryOf = (
    row: LegacyRow,
    insertables: Insertables
): LibraryId | undefined => {
    if (row.library) {
        return LIBRARY_IDS.has(row.library)
            ? (row.library as LibraryId)
            : undefined;
    }
    const holding = [...LIBRARY_IDS].filter((id) =>
        insertables.has(insertableKey(id, row.element_id ?? ""))
    );
    return holding.length === 1
        ? (holding[0] as LibraryId)
        : LibraryId.FRC_DESIGN_LIB;
};

/** What the conversion dropped, to report rather than hide. */
const counts = {
    skipped: new Map<string, number>(),
    values: 0,
    unknownParameter: 0,
    unknownOption: 0,
    unconfiguredPart: 0,
    removedPart: 0,
    creditedByName: 0,
    parameterByName: 0
};

const skip = (reason: string): undefined => {
    counts.skipped.set(reason, (counts.skipped.get(reason) ?? 0) + 1);
    return undefined;
};

const sameName = (a: string | null, b: string | null) =>
    a !== null && b !== null && nameKey(a) === nameKey(b);

/**
 * A re-created tab can give a parameter a new id. Two conditional parameters
 * can share a name, so the name places a value only when it is unambiguous on
 * both sides.
 */
const byUniqueName = (
    name: string | null,
    logged: LoggedValue[],
    parameters: ConfigurationParameter[]
): ConfigurationParameter | undefined => {
    const current = parameters.filter((p) => sameName(p.name, name));
    const loggedTwice =
        logged.filter((value) => sameName(value.name, name)).length > 1;
    if (current.length !== 1 || loggedTwice) return undefined;
    counts.parameterByName++;
    return current[0];
};

/**
 * The logged configuration as the live path would have stored it. An enum was
 * logged by its option's name, which is matched back to an id against the
 * part's parameters as they are now; a value they can no longer place is left
 * out, so the use still counts and only that option's tally misses it.
 */
const legacySelection = (
    logged: LoggedValue[],
    parameters: ConfigurationParameter[]
): Selection | null => {
    if (parameters.length === 0 || logged.length === 0) return null;
    const values: Selection = {};
    for (const { id, name, value } of logged) {
        counts.values++;
        const parameter =
            parameters.find((candidate) => candidate.id === id) ??
            byUniqueName(name, logged, parameters);
        if (!parameter || value === null) {
            counts.unknownParameter++;
            continue;
        }
        if (parameter.type === ParameterType.ENUM) {
            const option =
                parameter.options.find(
                    (candidate) => candidate.name === value
                ) ??
                parameter.options.find((candidate) => candidate.id === value);
            if (!option) {
                counts.unknownOption++;
                continue;
            }
            values[id] = option.id;
        } else if (parameter.type === ParameterType.BOOLEAN) {
            values[id] = value.trim().toLowerCase();
        } else {
            values[id] = value;
        }
    }
    return canonicalValues(values, parameters);
};

/** Every name each element was inserted under, lowercased, from the planning pass. */
type LoggedNames = Map<string, Set<string>>;

const nameKey = (name: string) => name.trim().toLowerCase();

const resolved = new Map<string, Insertable | undefined>();

/**
 * The part a logged element is now. A tab re-created since has a new element
 * id, so an element the library no longer holds is credited to the one part
 * there with a name it was inserted under, when exactly one has.
 */
const currentPart = (
    libraryId: LibraryId,
    elementId: string,
    insertables: Insertables,
    loggedNames: LoggedNames
): Insertable | undefined => {
    const key = insertableKey(libraryId, elementId);
    if (resolved.has(key)) return resolved.get(key);
    let part = insertables.get(key);
    if (!part) {
        const names = loggedNames.get(elementId) ?? new Set();
        const matches = [...insertables.values()].filter(
            (candidate) =>
                candidate.libraryId === libraryId &&
                names.has(nameKey(candidate.name))
        );
        part = matches.length === 1 ? matches[0] : undefined;
    }
    resolved.set(key, part);
    return part;
};

const TARGETS = new Set<string>([
    ElementType.PART_STUDIO,
    ElementType.ASSEMBLY
]);

/** A row as `trackInsert` or `trackAppOpen` would have logged it, with what its rollups need. */
const toEvent = (
    row: LegacyRow,
    insertables: Insertables,
    loggedNames: LoggedNames
): { event: LoggedEvent; parameters: ConfigurationParameter[] } | undefined => {
    if (!row.user_id) return skip("no user id");
    const createdAt = Number(row.created_at);
    const core = {
        id: `legacy-${row.id}`,
        createdAt: new Date(createdAt),
        day: toDayKey(createdAt),
        userId: row.user_id,
        schemaVersion: LEGACY_SCHEMA_VERSION
    };
    if (row.message === "App opened") {
        const event: LoggedEvent = {
            ...core,
            type: EventType.APP_OPEN,
            libraryId: null,
            ...NO_ELEMENT,
            ...NOT_A_USE,
            ...NOT_A_VERSION_RUN,
            ...NOT_A_REPORT
        };
        return { event, parameters: [] };
    }

    if (!row.element_id) return skip("insert without an element id");
    if (!row.target || !TARGETS.has(row.target))
        return skip("insert without a target tab type");
    const libraryId = libraryOf(row, insertables);
    if (!libraryId) return skip(`insert from unknown library ${row.library}`);

    const insertable = currentPart(
        libraryId,
        row.element_id,
        insertables,
        loggedNames
    );
    // The logged version belongs to the old element, so a credited use has none.
    const credited =
        insertable !== undefined && insertable.elementId !== row.element_id;
    if (!insertable) counts.removedPart++;
    if (credited) counts.creditedByName++;
    const parameters = insertable?.parameters ?? [];
    const logged = row.configuration
        ? (JSON.parse(row.configuration) as LoggedValue[])
        : [];
    if (logged.length > 0 && parameters.length === 0) counts.unconfiguredPart++;

    const event: LoggedEvent = {
        ...core,
        type: EventType.INSERT,
        libraryId,
        elementId: insertable?.elementId ?? row.element_id,
        documentId: insertable?.documentId ?? null,
        instanceId: credited ? null : row.version_id,
        instanceType: !credited && row.version_id ? "v" : null,
        insertableId: insertable?.id ?? null,
        targetElementType: row.target as ElementType,
        selection: legacySelection(logged, parameters),
        isFavorite: row.is_favorite === "true",
        isQuickInsert: row.quick_insert === "true",
        source: UseSource.UNKNOWN,
        fasten: row.fasten === "true",
        ...NOT_A_VERSION_RUN,
        ...NOT_A_REPORT
    };
    return { event, parameters };
};

// The Workers types aren't in this program; the builder below never uses one.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface D1Database {}
}

/** Builds statements only: `toSQL` never reaches the binding. */
const builder = getDb({});

/**
 * How a row from the import combines with the one already there, column by
 * column, mirroring each table's `onConflict` in `rollups.ts`. A column missing
 * here fails the build, so a new rollup column can't be merged by accident.
 */
const MERGES: [SQLiteTable, Record<string, "sum" | "min" | "max">][] = [
    [
        dailyMetrics,
        {
            count: "sum",
            favorite_count: "sum",
            fasten_count: "sum",
            quick_insert_count: "sum"
        }
    ],
    [dailyTargetMetrics, { count: "sum" }],
    [dailySourceMetrics, { count: "sum", quick_insert_count: "sum" }],
    [
        insertableStats,
        {
            insert_count: "sum",
            first_inserted_at: "min",
            last_inserted_at: "max"
        }
    ],
    [dailyInsertableMetrics, { count: "sum" }],
    [dailyInsertableUsers, {}],
    [dailyConfigurationMetrics, { count: "sum" }],
    [dailyUserActivity, {}],
    [
        userStats,
        { insert_count: "sum", first_seen_at: "min", last_seen_at: "max" }
    ],
    [dailyAppOpens, { opens: "sum" }]
];

const MERGE_SQL: Record<
    "sum" | "min" | "max",
    (table: string, column: string) => string
> = {
    sum: (t, c) => `"${c}" = "${t}"."${c}" + excluded."${c}"`,
    min: (t, c) => `"${c}" = min("${t}"."${c}", excluded."${c}")`,
    max: (t, c) => `"${c}" = max("${t}"."${c}", excluded."${c}")`
};

interface TableDump {
    name: string;
    columns: string[];
    /** Appended to each multi-row insert. */
    suffix: string;
}

const dumpPlan = (): TableDump[] => {
    const plan: TableDump[] = [
        // Plain inserts: applying a file twice fails on its first event, before
        // any rollup could be counted again.
        {
            name: getTableConfig(events).name,
            columns: getTableConfig(events).columns.map((c) => c.name),
            suffix: ""
        }
    ];
    for (const [table, merge] of MERGES) {
        const config = getTableConfig(table);
        const keys = config.primaryKeys[0].columns.map((column) => column.name);
        const columns = config.columns.map((column) => column.name);
        const unmerged = columns.filter(
            (c) => !keys.includes(c) && !(c in merge)
        );
        if (unmerged.length > 0) {
            throw new Error(
                `${config.name}: say how to merge ${unmerged.join(", ")}`
            );
        }
        const updates = Object.entries(merge).map(([column, how]) =>
            MERGE_SQL[how](config.name, column)
        );
        const conflict = `ON CONFLICT (${keys.map((k) => `"${k}"`).join(", ")})`;
        plan.push({
            name: config.name,
            columns,
            suffix:
                updates.length > 0
                    ? ` ${conflict} DO UPDATE SET ${updates.join(", ")}`
                    : ` ${conflict} DO NOTHING`
        });
    }
    return plan;
};

const MIGRATIONS = "drizzle";

/** A scratch database in the target's schema, so the real rollup writes run unchanged. */
const openScratch = (path: string): DatabaseSync => {
    rmSync(path, { force: true });
    const db = new DatabaseSync(path);
    db.exec(
        "PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF;"
    );
    for (const file of readdirSync(MIGRATIONS)
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        for (const statement of readFileSync(
            join(MIGRATIONS, file),
            "utf8"
        ).split("--> statement-breakpoint")) {
            if (statement.trim()) db.exec(statement);
        }
    }
    db.exec("BEGIN");
    return db;
};

/** One output file: consecutive days, applied in one atomic import. */
interface Chunk {
    from: string;
    to: string;
    db: DatabaseSync;
    statements: Map<string, ReturnType<DatabaseSync["prepare"]>>;
}

const run = (
    chunk: Chunk,
    query: { toSQL(): { sql: string; params: unknown[] } }
) => {
    const { sql, params } = query.toSQL();
    let statement = chunk.statements.get(sql);
    if (!statement) {
        statement = chunk.db.prepare(sql);
        chunk.statements.set(sql, statement);
    }
    statement.run(...(params as SQLInputValue[]));
};

const readLines = (path: string) =>
    createInterface({
        input: createReadStream(path, "utf8"),
        crlfDelay: Infinity
    });

/** Days packed in order into files of at most `max` events; a busy day is never split. */
/** One pass over the log: how to cut it into files, and each element's names. */
const survey = async (
    args: Args
): Promise<{
    days: { from: string; to: string }[];
    loggedNames: LoggedNames;
}> => {
    const perDay = new Map<string, number>();
    const loggedNames: LoggedNames = new Map();
    for await (const line of readLines(args.events)) {
        const row = JSON.parse(line) as LegacyRow;
        const day = toDayKey(Number(row.created_at));
        perDay.set(day, (perDay.get(day) ?? 0) + 1);
        if (row.element_id && row.name) {
            const names = loggedNames.get(row.element_id) ?? new Set<string>();
            names.add(nameKey(row.name));
            loggedNames.set(row.element_id, names);
        }
    }
    const chunks: { from: string; to: string }[] = [];
    let size = 0;
    for (const day of [...perDay.keys()].sort()) {
        const count = perDay.get(day)!;
        const last = chunks.at(-1);
        if (last && size + count <= args.maxEventsPerFile) {
            last.to = day;
            size += count;
        } else {
            chunks.push({ from: day, to: day });
            size = count;
        }
    }
    return { days: chunks, loggedNames };
};

/** D1 caps a statement at 100 KB. https://developers.cloudflare.com/d1/platform/limits/ */
const MAX_STATEMENT_BYTES = 90_000;

const sqlLiteral = (value: SQLOutputValue): string => {
    if (value === null) return "NULL";
    if (typeof value === "number" || typeof value === "bigint")
        return String(value);
    if (typeof value !== "string") throw new Error("no rollup stores a blob");
    return `'${value.replaceAll("'", "''")}'`;
};

const writeChunk = (chunk: Chunk, plan: TableDump[], path: string) => {
    const out = openSync(path, "w");
    for (const table of plan) {
        const head = `INSERT INTO "${table.name}" (${table.columns.map((c) => `"${c}"`).join(", ")}) VALUES `;
        let rows: string[] = [];
        let bytes = 0;
        const flush = () => {
            if (rows.length > 0)
                writeSync(out, head + rows.join(",") + table.suffix + ";\n");
            rows = [];
            bytes = 0;
        };
        const select = chunk.db.prepare(
            `SELECT ${table.columns.map((c) => `"${c}"`).join(", ")} FROM "${table.name}"`
        );
        for (const row of select.iterate() as Iterable<
            Record<string, SQLOutputValue>
        >) {
            const values = `(${table.columns.map((c) => sqlLiteral(row[c])).join(",")})`;
            if (
                bytes + values.length + head.length + table.suffix.length >
                MAX_STATEMENT_BYTES
            )
                flush();
            rows.push(values);
            bytes += values.length + 1;
        }
        flush();
    }
    closeSync(out);
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));

    const [{ imported }] = query<{ imported: number }>(
        args,
        `SELECT COUNT(*) AS imported FROM events WHERE schema_version = ${LEGACY_SCHEMA_VERSION}`
    );
    if (imported > 0) {
        throw new Error(
            `the target already holds ${imported} imported events; nothing to build`
        );
    }

    const insertables = readInsertables(args);
    console.error(`${insertables.size} insertables in the target`);

    const { days, loggedNames } = await survey(args);
    mkdirSync(args.out, { recursive: true });
    const chunks: Chunk[] = days.map((range, i) => ({
        ...range,
        db: openScratch(join(args.out, `scratch-${i}.sqlite`)),
        statements: new Map()
    }));
    const chunkOf = (day: string) =>
        chunks.find((c) => c.from <= day && day <= c.to)!;

    let converted = 0;
    for await (const line of readLines(args.events)) {
        const result = toEvent(
            JSON.parse(line) as LegacyRow,
            insertables,
            loggedNames
        );
        if (!result) continue;
        const chunk = chunkOf(result.event.day);
        run(chunk, builder.insert(events).values(result.event));
        for (const write of rollupWrites(
            builder,
            result.event,
            result.parameters
        )) {
            run(
                chunk,
                write as unknown as {
                    toSQL(): { sql: string; params: unknown[] };
                }
            );
        }
        if (++converted % 100_000 === 0)
            console.error(`${converted.toLocaleString()} events`);
    }

    const plan = dumpPlan();
    chunks.forEach((chunk, i) => {
        chunk.db.exec("COMMIT");
        const name = `${String(i + 1).padStart(2, "0")}-${chunk.from}_${chunk.to}.sql`;
        writeChunk(chunk, plan, join(args.out, name));
        chunk.db.close();
        rmSync(join(args.out, `scratch-${i}.sqlite`));
        console.error(`wrote ${name}`);
    });

    console.error(
        JSON.stringify(
            {
                converted,
                skipped: Object.fromEntries(counts.skipped),
                insertsCreditedByName: counts.creditedByName,
                insertsOfRemovedParts: counts.removedPart,
                insertsOfPartsNowUnconfigured: counts.unconfiguredPart,
                loggedValues: counts.values,
                valuesPlacedByParameterName: counts.parameterByName,
                valuesOfUnknownParameters: counts.unknownParameter,
                valuesOfUnknownOptions: counts.unknownOption
            },
            null,
            2
        )
    );
};

await main();
