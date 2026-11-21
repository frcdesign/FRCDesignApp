/**
 * Fills `daily_feature_users` from the event log, for the days before the
 * live write path began writing it (migration 0015's deploy).
 *
 *     npx tsx scripts/backfill-feature-users.ts --from 2025-11-13 --to 2026-11-17 --out out/feature-users.sql
 *     npx wrangler d1 execute DB --env production --remote --file=out/feature-users.sql
 *
 * The file is one statement a feature a week, each well inside D1's 30-second
 * limit (`featureUsersBackfill`). It only inserts what's missing, so a rerun,
 * or one overlapping days the live path already wrote, changes nothing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { addDays } from "../src/backend/features/analytics/day";
import { featureUsersBackfill } from "../src/backend/features/analytics/feature-users-backfill";

/** A week a chunk: about 50,000 events on prod's busiest. */
const CHUNK_DAYS = 7;

function argument(name: string): string {
    const index = process.argv.indexOf(`--${name}`);
    const value = index === -1 ? undefined : process.argv[index + 1];
    if (!value) {
        throw new Error(
            "Usage: backfill-feature-users.ts --from YYYY-MM-DD --to YYYY-MM-DD --out <file>"
        );
    }
    return value;
}

const from = argument("from");
const to = argument("to");
const out = argument("out");

const statements: string[] = [];
for (let start = from; start <= to; start = addDays(start, CHUNK_DAYS)) {
    const end = addDays(start, CHUNK_DAYS - 1);
    statements.push(
        ...featureUsersBackfill({ from: start, to: end < to ? end : to })
    );
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, statements.join("\n") + "\n");
console.log(`Wrote ${statements.length} statements to ${out}`);
