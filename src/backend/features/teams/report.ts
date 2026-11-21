/** A team's standing in each category this year, against every other team of its program, anonymously. */
import { and, between, countDistinct, eq, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { teams } from "../../db/schema";
import { dailyTeamMetrics, dailyTeamUsers } from "../analytics/schema";
import {
    MIN_RANKED_TEAMS,
    Medal,
    TEAM_CATEGORIES,
    type Program,
    type TeamCategory,
    type TeamReportOut,
    type TeamStanding
} from "./contract";
import { getTeamsById } from "./store";
import { binOf, toHistogram } from "../analytics/histogram";

/** September to August: a team's year spans either program's season and its build. */
export interface TeamYear {
    from: string;
    to: string;
    /** "2026–27". */
    label: string;
}

const YEAR_START_MONTH = 9;

export function teamYear(day: string): TeamYear {
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7));
    const start = month >= YEAR_START_MONTH ? year : year - 1;
    return {
        from: `${start}-09-01`,
        to: `${start + 1}-08-31`,
        label: `${start}–${String((start + 1) % 100).padStart(2, "0")}`
    };
}

/** Gold for the top tenth, silver the next 15%, bronze the next quarter. */
const MEDAL_CUTOFFS: [number, Medal][] = [
    [0.1, Medal.GOLD],
    [0.25, Medal.SILVER],
    [0.5, Medal.BRONZE]
];

/** Ranked among `values`, every team that used the category; undefined below the floor. */
export function rank(value: number, values: number[]): TeamStanding["ranking"] {
    if (values.length < MIN_RANKED_TEAMS || value <= 0) return undefined;
    // Ties share the best rank among them.
    const rank = 1 + values.filter((other) => other > value).length;
    const fraction = rank / values.length;
    const distribution = toHistogram(values, false);
    return {
        topPercent: Math.ceil(fraction * 100),
        medal: MEDAL_CUTOFFS.find(([cutoff]) => fraction <= cutoff)?.[1],
        distribution,
        teamBin: binOf(distribution.bins, value) ?? 0
    };
}

export async function getTeamReport(
    db: Db,
    teamId: string,
    today: string
): Promise<TeamReportOut | undefined> {
    const found = (await getTeamsById(db, [teamId])).get(teamId);
    if (!found) return undefined;
    const year = teamYear(today);
    const program = found.team.program;

    const members = await activeMembersByTeam(db, program, year);
    const counts = await countsByCategory(db, program, year);
    const activeMembers = members.get(teamId) ?? 0;

    const standings = TEAM_CATEGORIES.map((category): TeamStanding => {
        const byTeam = counts.get(category) ?? new Map<string, number>();
        const perMember = (team: string, uses: number) =>
            uses / Math.max(1, members.get(team) ?? 0);
        const uses = byTeam.get(teamId) ?? 0;
        const usesPerMember = perMember(teamId, uses);
        return {
            category,
            uses,
            usesPerMember,
            ranking: rank(
                usesPerMember,
                [...byTeam].map(([team, count]) => perMember(team, count))
            )
        };
    });
    return { first: found.first, year: year.label, activeMembers, standings };
}

async function activeMembersByTeam(
    db: Db,
    program: Program,
    year: TeamYear
): Promise<Map<string, number>> {
    const rows = await db
        .select({
            teamId: dailyTeamUsers.teamId,
            members: countDistinct(dailyTeamUsers.userId)
        })
        .from(dailyTeamUsers)
        .innerJoin(teams, eq(teams.id, dailyTeamUsers.teamId))
        .where(
            and(
                eq(teams.program, program),
                between(dailyTeamUsers.day, year.from, year.to)
            )
        )
        .groupBy(dailyTeamUsers.teamId)
        .all();
    return new Map(rows.map((row) => [row.teamId, row.members]));
}

/** Only teams with a use of a category appear under it. */
async function countsByCategory(
    db: Db,
    program: Program,
    year: TeamYear
): Promise<Map<TeamCategory, Map<string, number>>> {
    const rows = await db
        .select({
            category: dailyTeamMetrics.category,
            teamId: dailyTeamMetrics.teamId,
            count: sum(dailyTeamMetrics.count).mapWith(Number)
        })
        .from(dailyTeamMetrics)
        .innerJoin(teams, eq(teams.id, dailyTeamMetrics.teamId))
        .where(
            and(
                eq(teams.program, program),
                between(dailyTeamMetrics.day, year.from, year.to)
            )
        )
        .groupBy(dailyTeamMetrics.category, dailyTeamMetrics.teamId)
        .all();
    const counts = new Map<TeamCategory, Map<string, number>>();
    for (const row of rows) {
        const byTeam = counts.get(row.category) ?? new Map<string, number>();
        byTeam.set(row.teamId, row.count);
        counts.set(row.category, byTeam);
    }
    return counts;
}
