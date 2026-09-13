/**
 * Turns the extracted legacy favorites into D1 statements for one environment.
 *
 *     node scripts/migrate-favorites/build-sql.ts \
 *         --favorites out/favorites.json --env cert --out out/favorites.sql
 *
 * Reads the target's own `insertables` and `configurations` over wrangler,
 * because two of the three things a legacy favorite needs are only knowable
 * there: the insertable uuid behind an Onshape element id, and the parameters a
 * stored configuration has to be made canonical against.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ConfigurationParameter } from "../../src/backend/features/configurations/contract";
import { toSelection } from "../../src/backend/features/configurations/selection";

interface LegacyFavorite {
    libraryId: string;
    userId: string;
    elementId: string;
    configuration: Record<string, string> | null;
}

interface LegacyExport {
    favorites: LegacyFavorite[];
    /** Keyed `<libraryId>|<userId>`, holding element ids in display order. */
    favoriteOrder: Record<string, string[]>;
    userLibrary: Record<string, string>;
}

interface Args {
    favorites: string;
    env: string;
    out: string;
}

const parseArgs = (argv: string[]): Args => {
    const args: Record<string, string> = {};
    for (let i = 0; i < argv.length; i += 2) {
        args[argv[i].replace(/^--/, "")] = argv[i + 1];
    }
    for (const key of ["favorites", "env", "out"]) {
        if (!args[key]) throw new Error(`missing --${key}`);
    }
    return args as unknown as Args;
};

/** One read against the target database, as rows. */
const query = <T>(env: string, sql: string): T[] => {
    const out = execFileSync(
        "npx",
        [
            "wrangler",
            "d1",
            "execute",
            "DB",
            "--env",
            env,
            "--remote",
            "--json",
            "--command",
            sql
        ],
        { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
    );
    return (JSON.parse(out) as { results: T[] }[])[0].results;
};

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/**
 * A favorite's row id, derived from what the table already holds unique rather
 * than random, so a re-run writes the same ids and `INSERT OR IGNORE` makes the
 * whole migration repeatable.
 */
const favoriteId = (
    userId: string,
    libraryId: string,
    insertableId: string
): string => {
    const h = createHash("sha256")
        .update(`favorite:${userId}:${libraryId}:${insertableId}`)
        .digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
};

const main = () => {
    const args = parseArgs(process.argv.slice(2));
    const legacy = JSON.parse(
        readFileSync(args.favorites, "utf8")
    ) as LegacyExport;

    const insertables = query<{
        id: string;
        element_id: string;
        library_id: string;
    }>(args.env, "SELECT id, element_id, library_id FROM insertables");
    // Keyed by library too: three documents are shared between the libraries,
    // so one element id can be two insertables.
    const insertableByElement = new Map(
        insertables.map((row) => [
            `${row.library_id}|${row.element_id}`,
            row.id
        ])
    );

    const libraries = new Set(
        query<{ id: string }>(args.env, "SELECT id FROM libraries").map(
            (row) => row.id
        )
    );

    const resolved: {
        favorite: LegacyFavorite;
        insertableId: string;
    }[] = [];
    const skipped: LegacyFavorite[] = [];
    for (const favorite of legacy.favorites) {
        const insertableId = insertableByElement.get(
            `${favorite.libraryId}|${favorite.elementId}`
        );
        if (insertableId && libraries.has(favorite.libraryId)) {
            resolved.push({ favorite, insertableId });
        } else {
            skipped.push(favorite);
        }
    }

    // Only the insertables a stored configuration actually names: parameters are
    // large, and all but a couple hundred favorites open on the defaults.
    const configured = [
        ...new Set(
            resolved
                .filter(({ favorite }) => favorite.configuration)
                .map(({ insertableId }) => insertableId)
        )
    ];
    const parametersById = new Map<string, ConfigurationParameter[]>();
    for (const ids of chunk(configured, 100)) {
        const rows = query<{ insertable_id: string; parameters: string }>(
            args.env,
            `SELECT insertable_id, parameters FROM configurations WHERE insertable_id IN (${ids
                .map(sqlString)
                .join(", ")})`
        );
        for (const row of rows) {
            parametersById.set(
                row.insertable_id,
                JSON.parse(row.parameters) as ConfigurationParameter[]
            );
        }
    }

    // Every user who ends up owning a row, since `favorites.user_id` is a
    // foreign key and most of these have never signed in to the new app. The
    // library is the one they last used, falling back to the one they favorited
    // in — the same pair of columns the add-favorite route writes.
    const userLibrary = new Map<string, string>();
    for (const { favorite } of resolved) {
        if (!userLibrary.has(favorite.userId)) {
            const preferred = legacy.userLibrary[favorite.userId];
            userLibrary.set(
                favorite.userId,
                preferred && libraries.has(preferred)
                    ? preferred
                    : favorite.libraryId
            );
        }
    }

    // Display order, read off the owner's `favoriteOrder`. Ones it never listed
    // go after everything it did, ranked by element id so that two unlisted
    // favorites cannot land on the same order. Gaps are left where a skipped
    // favorite used to sit: the add-favorite route orders from the highest
    // taken rather than the count, precisely so a gap is harmless.
    //
    // These orders start at 0 and ignore whatever the table already holds, so
    // an owner who favorited something in the live app before the import gets a
    // collision rather than a gap. Two rows did on the production run, and were
    // moved to the end by hand afterwards. Re-running against a library people
    // are already using wants a per-owner offset here first.
    const ownerKey = (favorite: LegacyFavorite) =>
        `${favorite.libraryId}|${favorite.userId}`;
    const byOwner = new Map<string, LegacyFavorite[]>();
    for (const { favorite } of resolved) {
        const owned = byOwner.get(ownerKey(favorite)) ?? [];
        owned.push(favorite);
        byOwner.set(ownerKey(favorite), owned);
    }
    const sortOrders = new Map<string, number>();
    for (const [key, owned] of byOwner) {
        const order = legacy.favoriteOrder[key] ?? [];
        const unlisted = owned
            .map((favorite) => favorite.elementId)
            .filter((elementId) => !order.includes(elementId))
            .sort();
        for (const favorite of owned) {
            const index = order.indexOf(favorite.elementId);
            sortOrders.set(
                `${key}|${favorite.elementId}`,
                index === -1
                    ? order.length + unlisted.indexOf(favorite.elementId)
                    : index
            );
        }
    }

    const rows: string[] = [];
    let canonicalized = 0;
    let droppedSelection = 0;
    for (const { favorite, insertableId } of resolved) {
        const sortOrder = sortOrders.get(
            `${ownerKey(favorite)}|${favorite.elementId}`
        )!;

        const parameters = parametersById.get(insertableId) ?? [];
        let selection: string | null = null;
        if (favorite.configuration) {
            if (parameters.length > 0) {
                // Raw legacy values ("0.5 in", "13.75 mm") are display spellings;
                // this is what puts them in base units, fills in every parameter
                // the element declares, and drops ones it no longer does.
                selection = JSON.stringify(
                    toSelection(favorite.configuration, parameters)
                );
                canonicalized += 1;
            } else {
                // Nothing left to configure, which the contract spells as null.
                droppedSelection += 1;
            }
        }

        rows.push(
            `(${[
                sqlString(
                    favoriteId(
                        favorite.userId,
                        favorite.libraryId,
                        insertableId
                    )
                ),
                sqlString(favorite.userId),
                sqlString(favorite.libraryId),
                sqlString(insertableId),
                selection === null ? "NULL" : sqlString(selection),
                String(sortOrder),
                // No legacy timestamp exists, and the column is nullable for
                // exactly this reason.
                "NULL"
            ].join(", ")})`
        );
    }

    const statements: string[] = [
        "-- Favorites migrated from the legacy Datastore export.",
        "-- Generated by scripts/migrate-favorites/build-sql.ts; do not edit.",
        `-- Target: ${args.env}`,
        ""
    ];
    for (const users of chunk([...userLibrary], 500)) {
        statements.push(
            "INSERT OR IGNORE INTO users (id, library_id) VALUES\n" +
                users
                    .map(
                        ([id, library]) =>
                            `  (${sqlString(id)}, ${sqlString(library)})`
                    )
                    .join(",\n") +
                ";"
        );
    }
    for (const batch of chunk(rows, 500)) {
        statements.push(
            "INSERT OR IGNORE INTO favorites\n" +
                "  (id, user_id, library_id, insertable_id, default_selection, sort_order, created_at)\n" +
                "VALUES\n" +
                batch.map((row) => `  ${row}`).join(",\n") +
                ";"
        );
    }

    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, statements.join("\n\n") + "\n");

    const skippedElements = new Set(
        skipped.map((f) => `${f.libraryId}|${f.elementId}`)
    );
    console.log(`legacy favorites:      ${legacy.favorites.length}`);
    console.log(`  migrated:            ${resolved.length}`);
    console.log(
        `  skipped:             ${skipped.length} ` +
            `(${skippedElements.size} elements no longer in ${args.env})`
    );
    console.log(`user rows ensured:     ${userLibrary.size}`);
    console.log(`selections canonicalized: ${canonicalized}`);
    console.log(`selections dropped as unconfigurable: ${droppedSelection}`);
    console.log(`\nwrote ${args.out}`);
};

main();
