#!/usr/bin/env python3
"""
Applies every migration to a database that already holds rows.

An empty database is the one case a bad migration survives: a table rebuild that
copies nothing cannot lose anything, so `wrangler d1 migrations apply --local`
against a fresh database passes exactly the migrations that go on to break cert.
This runs the chain twice — once from empty, once with rows seeded before each
step — and fails on the three ways a migration goes wrong in practice:

  * it errors part-way, leaving a `__new_*` or `__old_*` table behind
  * a table loses rows it should have kept
  * a column's values change when only its name was supposed to

Seed from a real dump when you have one, which is the closest thing to what cert
will actually run:

    wrangler d1 export DB --remote --env cert --output cert.sql
    scripts/check-migrations.py --dump cert.sql
"""

import argparse
import pathlib
import sqlite3
import sys
import tempfile

MIGRATIONS = pathlib.Path("drizzle")


def steps() -> list[pathlib.Path]:
    return sorted(MIGRATIONS.glob("[0-9]*.sql"))


def apply(db: sqlite3.Connection, path: pathlib.Path) -> None:
    for statement in path.read_text().split("--> statement-breakpoint"):
        if statement.strip():
            db.executescript(statement)
    db.commit()


def tables(db: sqlite3.Connection) -> list[str]:
    rows = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
    ).fetchall()
    return [name for (name,) in rows]


def debris(db: sqlite3.Connection) -> list[str]:
    """Tables drizzle's rebuild leaves behind when it fails part-way."""
    return [t for t in tables(db) if t.startswith("__")]


def counts(db: sqlite3.Connection) -> dict[str, int]:
    return {
        t: db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        for t in tables(db)
        if not t.startswith("__")
    }


def seed(db: sqlite3.Connection, dump: pathlib.Path | None) -> None:
    """Rows for the migrations to carry. A real dump beats anything synthetic."""
    if dump is not None:
        db.executescript(dump.read_text())
        db.commit()
        return
    # Enough of the app's shape to exercise the foreign keys and the cascade.
    db.executescript(
        """
        INSERT OR IGNORE INTO libraries (id) VALUES ('frc-design-lib');
        INSERT OR IGNORE INTO groups (id, library_id, name, document_id, version_id)
            VALUES ('g1', 'frc-design-lib', 'Tubes', 'd1', 'v1');
        """
    )
    for i in (1, 2, 3):
        db.execute(
            "INSERT OR IGNORE INTO insertables (id, element_id, group_id, document_id,"
            " library_id, name, element_type, microversion_id, version_id)"
            f" VALUES ('i{i}','e{i}','g1','d1','frc-design-lib','Part {i}',"
            "'PARTSTUDIO','m1','v1')"
        )
    db.commit()
    # Named per migration, since the column it is keyed by is what 0002 renames.
    key = "insertable_id" if has_column(db, "configurations", "insertable_id") else "id"
    for i in (1, 2, 3):
        db.execute(
            f'INSERT OR IGNORE INTO configurations ("{key}") VALUES (?)', (f"i{i}",)
        )
    db.execute(
        "INSERT OR IGNORE INTO events (id, type, created_at, day, library_id, user_id)"
        " VALUES ('ev1','insert',1757000000000,'2026-09-04','frc-design-lib','u1')"
    )
    db.commit()


def has_column(db: sqlite3.Connection, table: str, column: str) -> bool:
    if table not in tables(db):
        return False
    return any(
        row[1] == column for row in db.execute(f'PRAGMA table_info("{table}")')
    )


def run(dump: pathlib.Path | None, populated: bool) -> list[str]:
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        db = sqlite3.connect(f"{tmp}/check.db")
        db.execute("PRAGMA foreign_keys=ON")
        for step in steps():
            before = counts(db) if populated else {}
            try:
                apply(db, step)
            except Exception as error:  # noqa: BLE001 - reported, not handled
                failures.append(f"{step.name}: failed to apply — {error}")
                left = debris(db)
                if left:
                    failures.append(f"{step.name}: left {', '.join(left)} behind")
                return failures
            left = debris(db)
            if left:
                failures.append(f"{step.name}: left {', '.join(left)} behind")
            after = counts(db)
            for table, count in before.items():
                if table in after and after[table] < count:
                    failures.append(
                        f"{step.name}: {table} lost rows ({count} -> {after[table]})"
                    )
            if populated:
                seed(db, dump)
        # A rename must keep the values, not just the row count.
        if populated and has_column(db, "configurations", "insertable_id"):
            keys = [
                row[0]
                for row in db.execute("SELECT insertable_id FROM configurations")
            ]
            bad = [k for k in keys if not str(k).startswith("i")]
            if bad:
                failures.append(
                    f"configurations.insertable_id holds {bad[:3]}, not the seeded ids"
                )
        db.close()
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dump",
        type=pathlib.Path,
        help="a `wrangler d1 export` dump to seed from instead of the built-in rows",
    )
    args = parser.parse_args()

    if not steps():
        print("no migrations found in drizzle/")
        return 1

    failures: list[str] = []
    for label, populated in (("empty", False), ("populated", True)):
        found = run(args.dump if populated else None, populated)
        print(f"{label:10} {'FAIL' if found else 'ok'}")
        failures += found

    for failure in failures:
        print(f"  {failure}")
    if failures:
        print("\nA migration that only passes on an empty database will break cert.")
        return 1
    print(f"\n{len(steps())} migrations apply cleanly, with and without data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
