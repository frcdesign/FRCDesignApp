/** The one place that decides which team a use is credited to. */
import { getDb } from "../../db/client";
import { type AppBindings } from "../../lib/context";
import { describeError } from "../../lib/error-text";
import { PERSONAL_COMPANY_ID } from "../auth/personal-company";
import { PERSONAL, TeamContextSource } from "./contract";
import {
    chosenTeamStore,
    documentOwnerStore,
    getMemberships,
    getOrganizationRegistrations
} from "./store";

export interface TeamContext {
    teamId: string;
    source: TeamContextSource;
}

/**
 * The document's team when its organization registered one of the user's
 * teams; otherwise the team they chose, or their latest. Undefined for a user
 * on no team, or one who chose Personal outside a team's document.
 */
export async function resolveTeamContext(
    env: AppBindings,
    userId: string,
    documentId: string | undefined
): Promise<TeamContext | undefined> {
    const db = getDb(env.DB);
    const memberships = await getMemberships(db, userId);
    if (memberships.length === 0) return undefined;
    const chosen = await chosenTeamStore.get(env.KV, userId);

    const owner = documentId
        ? await documentOwnerStore.get(env.KV, documentId)
        : undefined;
    if (owner && owner.companyId !== PERSONAL_COMPANY_ID) {
        const registered = new Set(
            (await getOrganizationRegistrations(db, owner.companyId)).map(
                (registration) => registration.teamId
            )
        );
        const mine = memberships.filter((membership) =>
            registered.has(membership.teamId)
        );
        if (mine.length > 0) {
            // Several of the organization's teams: the one chosen, if it's among them.
            const team =
                mine.find((membership) => membership.teamId === chosen) ??
                mine[0];
            return { teamId: team.teamId, source: TeamContextSource.DOCUMENT };
        }
    }

    if (chosen === PERSONAL) return undefined;
    const team =
        memberships.find((membership) => membership.teamId === chosen) ??
        memberships[0];
    return { teamId: team.teamId, source: TeamContextSource.CHOSEN };
}

/** For tracking: a failure credits no team rather than losing the event. */
export async function creditedTeamId(
    env: AppBindings,
    userId: string,
    documentId: string | undefined
): Promise<string | null> {
    try {
        return (
            (await resolveTeamContext(env, userId, documentId))?.teamId ?? null
        );
    } catch (error) {
        console.error(`Failed to resolve a team: ${describeError(error)}`);
        return null;
    }
}
