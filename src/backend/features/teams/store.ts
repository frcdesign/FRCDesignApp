/** Reads and writes of who is on which team, and what each document's organization is. */
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { type Db } from "../../db/client";
import {
    firstTeams,
    teamMembers,
    teamOrganizations,
    teams
} from "../../db/schema";
import { kvStore } from "../../lib/kv-store";
import {
    MEMBERSHIP_DAYS,
    OrganizationKind,
    TeamRole,
    type FirstTeam,
    type MyTeam,
    type TeamSettings
} from "./contract";

/** Who owns a document: a company, or a person (`cad`, `PERSONAL_COMPANY_ID`). */
export interface DocumentOwner {
    companyId: string;
    /** Undefined for a person. */
    kind?: OrganizationKind;
}

/**
 * Written at `/init` from the document it already read, so an insert into the
 * document can be credited to a team without asking Onshape who owns it.
 */
export const documentOwnerStore = kvStore<DocumentOwner>("document-owner", {
    ttlSeconds: 30 * 24 * 60 * 60
});

/** A team id, or `PERSONAL`. Losing it switches the user back to their latest team. */
export const chosenTeamStore = kvStore<string>("chosen-team");

type TeamRow = typeof teams.$inferSelect;
type FirstTeamRow = typeof firstTeams.$inferSelect;

/** Falls back to the number alone for a team FIRST hasn't listed. */
export function toFirstTeam(
    team: Pick<TeamRow, "program" | "number">,
    first: FirstTeamRow | null | undefined
): FirstTeam {
    return {
        program: team.program,
        number: team.number,
        name: first?.name ?? "",
        city: first?.city ?? undefined,
        stateProvince: first?.stateProvince ?? undefined,
        country: first?.country ?? undefined
    };
}

export function toSettings(team: TeamRow): TeamSettings {
    return {
        membersEditFavorites: team.membersEditFavorites,
        vendorRanking: team.vendorRanking,
        colors: team.colors,
        genericVendor: team.genericVendor
    };
}

/** The teams with their FIRST rows, keyed by team id. */
export async function getTeamsById(
    db: Db,
    teamIds: string[]
): Promise<Map<string, { team: TeamRow; first: FirstTeam }>> {
    if (teamIds.length === 0) return new Map();
    const rows = await db
        .select({ team: teams, first: firstTeams })
        .from(teams)
        .leftJoin(
            firstTeams,
            and(
                eq(firstTeams.program, teams.program),
                eq(firstTeams.number, teams.number)
            )
        )
        .where(inArray(teams.id, teamIds))
        .all();
    return new Map(
        rows.map((row) => [
            row.team.id,
            { team: row.team, first: toFirstTeam(row.team, row.first) }
        ])
    );
}

/** The caller's teams, the one they were last seen on first. */
export async function getMyTeams(db: Db, userId: string): Promise<MyTeam[]> {
    const memberships = await getMemberships(db, userId);
    const byId = await getTeamsById(
        db,
        memberships.map((membership) => membership.teamId)
    );
    return memberships.flatMap((membership) => {
        const found = byId.get(membership.teamId);
        return found
            ? [
                  {
                      id: found.team.id,
                      first: found.first,
                      role: membership.role,
                      settings: toSettings(found.team)
                  }
              ]
            : [];
    });
}

/** The earliest last-seen a membership can have and still count. */
export function membershipCutoff(now = Date.now()): Date {
    return new Date(now - MEMBERSHIP_DAYS * 24 * 60 * 60 * 1000);
}

/** Only memberships a launch proved within `MEMBERSHIP_DAYS`. */
export function isCurrentMember() {
    return gte(teamMembers.lastSeenAt, membershipCutoff());
}

export function getMemberships(db: Db, userId: string) {
    return db
        .select({ teamId: teamMembers.teamId, role: teamMembers.role })
        .from(teamMembers)
        .where(and(eq(teamMembers.userId, userId), isCurrentMember()))
        .orderBy(desc(teamMembers.lastSeenAt))
        .all();
}

export async function getRole(
    db: Db,
    teamId: string,
    userId: string
): Promise<TeamRole | undefined> {
    const row = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(
            and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId),
                isCurrentMember()
            )
        )
        .get();
    return row?.role;
}

export function getOrganizationRegistrations(db: Db, companyId: string) {
    return db
        .select()
        .from(teamOrganizations)
        .where(eq(teamOrganizations.companyId, companyId))
        .all();
}

/** Joins a member, or moves an existing one's last seen; never changes a role. */
/**
 * Joins a member or moves an existing one's last seen. A role Onshape was just
 * asked about replaces the stored one; without one, the stored role stands.
 */
export function upsertMember(
    db: Db,
    teamId: string,
    userId: string,
    checked: TeamRole | undefined,
    now: Date
) {
    return db
        .insert(teamMembers)
        .values({
            teamId,
            userId,
            role: checked ?? TeamRole.MEMBER,
            joinedAt: now,
            lastSeenAt: now,
            roleCheckedAt: checked ? now : new Date(0)
        })
        .onConflictDoUpdate({
            target: [teamMembers.teamId, teamMembers.userId],
            set: checked
                ? { lastSeenAt: now, role: checked, roleCheckedAt: now }
                : { lastSeenAt: now }
        });
}
