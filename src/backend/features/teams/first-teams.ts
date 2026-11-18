/** FIRST's lists of FRC and FTC teams, copied weekly into `first_teams` for registration's search. */
import type { BatchItem } from "drizzle-orm/batch";
import { sql } from "drizzle-orm";
import { getDb, type Db } from "../../db/client";
import { firstTeams } from "../../db/schema";
import { type AppBindings } from "../../lib/context";
import { describeError } from "../../lib/error-text";
import { Program } from "./contract";

/** One team as FIRST's Events APIs list it, FRC's v3 and FTC's v2 alike. */
interface FirstApiTeam {
    teamNumber: number;
    nameShort?: string | null;
    nameFull?: string | null;
    city?: string | null;
    stateProv?: string | null;
    country?: string | null;
    rookieYear?: number | null;
}

interface FirstApiPage {
    teams: FirstApiTeam[];
    pageCurrent: number;
    pageTotal: number;
}

interface ProgramApi {
    url: (season: number, page: number) => string;
    username: keyof AppBindings;
    token: keyof AppBindings;
    /** The seasons worth listing on a day, as FIRST numbers them. */
    seasons: (now: Date) => number[];
}

const PROGRAM_APIS: Record<Program, ProgramApi> = {
    [Program.FRC]: {
        url: (season, page) =>
            `https://frc-api.firstinspires.org/v3.0/${season}/teams?page=${page}`,
        username: "FIRST_FRC_API_USERNAME",
        token: "FIRST_FRC_API_TOKEN",
        // FRC numbers a season by the year it competes in; teams register for it from the autumn before.
        seasons: (now) =>
            now.getUTCMonth() >= 8
                ? [now.getUTCFullYear(), now.getUTCFullYear() + 1]
                : [now.getUTCFullYear()]
    },
    [Program.FTC]: {
        url: (season, page) =>
            `https://ftc-api.firstinspires.org/v2.0/${season}/teams?page=${page}`,
        username: "FIRST_FTC_API_USERNAME",
        token: "FIRST_FTC_API_TOKEN",
        // FTC numbers a season by the year it starts in, each September.
        seasons: (now) => [
            now.getUTCMonth() >= 8
                ? now.getUTCFullYear()
                : now.getUTCFullYear() - 1
        ]
    }
};

/** A runaway paging loop stops here; FTC, the larger, lists under 150 pages. */
const MAX_PAGES = 400;

/** Every program whose credentials are set; one failing leaves the other's refresh. */
export async function refreshFirstTeams(
    env: AppBindings,
    now = new Date()
): Promise<void> {
    for (const program of Object.values(Program)) {
        try {
            const count = await refreshProgram(env, program, now);
            console.log(`Refreshed ${count} ${program} teams`);
        } catch (error) {
            console.error(
                `Failed to refresh ${program} teams: ${describeError(error)}`
            );
        }
    }
}

async function refreshProgram(
    env: AppBindings,
    program: Program,
    now: Date
): Promise<number> {
    const api = PROGRAM_APIS[program];
    const username = env[api.username];
    const token = env[api.token];
    if (typeof username !== "string" || typeof token !== "string") {
        console.warn(`No FIRST API credentials for ${program}; skipped`);
        return 0;
    }
    const authorization = `Basic ${btoa(`${username}:${token}`)}`;
    const db = getDb(env.DB);
    let count = 0;
    for (const season of api.seasons(now)) {
        for (let page = 1; page <= MAX_PAGES; page++) {
            const response = await fetch(api.url(season, page), {
                headers: {
                    Authorization: authorization,
                    Accept: "application/json"
                }
            });
            if (!response.ok) {
                throw new Error(
                    `FIRST answered ${response.status} for ${program} ${season} page ${page}`
                );
            }
            const body: FirstApiPage = await response.json();
            await upsertTeams(db, program, season, body.teams);
            count += body.teams.length;
            if (body.pageCurrent >= body.pageTotal) break;
        }
    }
    return count;
}

export async function upsertTeams(
    db: Db,
    program: Program,
    season: number,
    teams: FirstApiTeam[]
): Promise<void> {
    const writes: BatchItem<"sqlite">[] = teams.map((team) => {
        const row = {
            program,
            number: team.teamNumber,
            name: team.nameShort?.trim() || `Team ${team.teamNumber}`,
            city: team.city ?? null,
            stateProvince: team.stateProv ?? null,
            country: team.country ?? null,
            rookieYear: team.rookieYear ?? null,
            lastSeason: season
        };
        return db
            .insert(firstTeams)
            .values(row)
            .onConflictDoUpdate({
                target: [firstTeams.program, firstTeams.number],
                set: {
                    name: row.name,
                    city: row.city,
                    stateProvince: row.stateProvince,
                    country: row.country,
                    rookieYear: row.rookieYear,
                    // Seasons are listed out of order on a September day.
                    lastSeason: sql`max(${firstTeams.lastSeason}, ${season})`
                }
            });
    });
    if (writes.length > 0) {
        await db.batch([writes[0], ...writes.slice(1)]);
    }
}
