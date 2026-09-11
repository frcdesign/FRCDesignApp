/**
 * Applies every migration to a database that already holds rows.
 *
 * An empty database is the one case a bad migration survives: a table rebuild
 * that copies nothing cannot lose anything, so `wrangler d1 migrations apply
 * --local` against a fresh database passes exactly the migrations that go on to
 * break cert. This runs the chain twice — once from empty, once with rows seeded
 * before each step — and fails on the three ways a migration goes wrong here:
 *
 *   - it errors part-way, leaving a `__new_*` or `__old_*` table behind
 *   - a table loses rows it should have kept
 *   - a column's values change when only its name was meant to
 *
 * This runs on `node:sqlite`, not on the SQLite D1 runs, and the two differ in
 * one way worth knowing: D1's accepts an unknown double-quoted identifier as a
 * string literal, while this rejects it outright. That makes the check stricter
 * than the deploy rather than looser, which is the safe direction — a migration
 * `wrangler d1 migrations apply --local` reports a cheerful tick for can still
 * fail here, and that is the whole point.
 *
 * Seed from a real dump when you have one, which is the closest thing to what
 * cert will actually run:
 *
 *     wrangler d1 export DB --remote --env cert --output cert.sql
 *     npm run check:migrations -- --dump cert.sql
 */
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIGRATIONS = "drizzle";

function steps() {
    return readdirSync(MIGRATIONS)
        .filter((name) => /^\d.*\.sql$/.test(name))
        .sort();
}

function apply(db, name) {
    const sql = readFileSync(join(MIGRATIONS, name), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
        if (statement.trim()) db.exec(statement);
    }
}

function tables(db) {
    return db
        .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' " +
                "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
        )
        .all()
        .map((row) => row.name);
}

/** Tables drizzle's rebuild leaves behind when it fails part-way. */
function debris(db) {
    return tables(db).filter((name) => name.startsWith("__"));
}

function counts(db) {
    const result = {};
    for (const table of tables(db)) {
        if (table.startsWith("__")) continue;
        result[table] = db
            .prepare(`SELECT COUNT(*) AS n FROM "${table}"`)
            .get().n;
    }
    return result;
}

function hasColumn(db, table, column) {
    if (!tables(db).includes(table)) return false;
    return db
        .prepare(`PRAGMA table_info("${table}")`)
        .all()
        .some((row) => row.name === column);
}

/** Rows for the migrations to carry. A real dump beats anything synthetic. */
function seed(db, dump) {
    if (dump) {
        db.exec(readFileSync(dump, "utf8"));
        return;
    }
    db.exec(`
        INSERT OR IGNORE INTO libraries (id) VALUES ('frc-design-lib');
        INSERT OR IGNORE INTO groups (id, library_id, name, document_id, version_id)
            VALUES ('g1', 'frc-design-lib', 'Tubes', 'd1', 'v1');
    `);
    for (const i of [1, 2, 3]) {
        db.exec(
            "INSERT OR IGNORE INTO insertables (id, element_id, group_id, document_id," +
                " library_id, name, element_type, microversion_id, version_id)" +
                ` VALUES ('i${i}','e${i}','g1','d1','frc-design-lib','Part ${i}',` +
                "'PARTSTUDIO','m1','v1')"
        );
    }
    // Named per migration, since the column it is keyed by is what 0001 renames.
    const key = hasColumn(db, "configurations", "insertable_id")
        ? "insertable_id"
        : "id";
    for (const i of [1, 2, 3]) {
        db.exec(
            `INSERT OR IGNORE INTO configurations ("${key}") VALUES ('i${i}')`
        );
    }
    db.exec(
        "INSERT OR IGNORE INTO events (id, type, created_at, day, library_id, user_id)" +
            " VALUES ('ev1','insert',1757000000000,'2026-09-04','frc-design-lib','u1')"
    );
}

function run(dump, populated) {
    const failures = [];
    const dir = mkdtempSync(join(tmpdir(), "migrations-"));
    const db = new DatabaseSync(join(dir, "check.db"));
    try {
        db.exec("PRAGMA foreign_keys=ON");
        for (const step of steps()) {
            const before = populated ? counts(db) : {};
            try {
                apply(db, step);
            } catch (error) {
                failures.push(`${step}: failed to apply — ${error.message}`);
                const left = debris(db);
                if (left.length) {
                    failures.push(`${step}: left ${left.join(", ")} behind`);
                }
                return failures;
            }
            const left = debris(db);
            if (left.length) {
                failures.push(`${step}: left ${left.join(", ")} behind`);
            }
            const after = counts(db);
            for (const [table, count] of Object.entries(before)) {
                if (table in after && after[table] < count) {
                    failures.push(
                        `${step}: ${table} lost rows (${count} -> ${after[table]})`
                    );
                }
            }
            if (populated) seed(db, dump);
        }
        // A rename must keep the values, not just the row count.
        if (populated && hasColumn(db, "configurations", "insertable_id")) {
            const bad = db
                .prepare("SELECT insertable_id AS key FROM configurations")
                .all()
                .map((row) => row.key)
                .filter((key) => !String(key).startsWith("i"));
            if (bad.length) {
                failures.push(
                    `configurations.insertable_id holds ${bad.slice(0, 3).join(", ")}, not the seeded ids`
                );
            }
        }
    } finally {
        db.close();
        rmSync(dir, { recursive: true, force: true });
    }
    return failures;
}

const dumpFlag = process.argv.indexOf("--dump");
const dump = dumpFlag === -1 ? undefined : process.argv[dumpFlag + 1];

if (steps().length === 0) {
    console.error("no migrations found in drizzle/");
    process.exit(1);
}

const failures = [];
for (const [label, populated] of [
    ["empty", false],
    ["populated", true]
]) {
    const found = run(populated ? dump : undefined, populated);
    console.log(`${label.padEnd(10)} ${found.length ? "FAIL" : "ok"}`);
    failures.push(...found);
}

for (const failure of failures) console.log(`  ${failure}`);
if (failures.length) {
    console.log(
        "\nA migration that only passes on an empty database will break cert."
    );
    process.exit(1);
}
console.log(
    `\n${steps().length} migrations apply cleanly, with and without data.`
);
