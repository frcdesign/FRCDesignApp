import { OAuthApi, OnshapeApi } from "../client";
import { AccessLevel } from "../../../features/auth/access-level";

interface SessionInfo {
    id: string;
    /** The company the current access token is scoped to; null/absent for a personal context. */
    company?: { id: string } | null;
}

export function getSessionInfo(client: OAuthApi): Promise<SessionInfo> {
    return client.get("/users/sessioninfo");
}

/** Returns the user ID associated with the current session. */
export function getUserId(client: OAuthApi): Promise<string> {
    return getSessionInfo(client).then((info) => info.id);
}

/** Returns the access level of the authenticated user relative to a given team. */
export async function getAccessLevel(
    client: OnshapeApi,
    teamId: string
): Promise<AccessLevel> {
    try {
        const teamInfo = await client.get(
            `/teams/${encodeURIComponent(teamId)}`
        );
        if (teamInfo.admin) return AccessLevel.ADMIN;
        if (teamInfo.member) return AccessLevel.EDITOR;
        return AccessLevel.USER;
    } catch {
        // Onshape returns an error for teams the user isn't a member of
        return AccessLevel.USER;
    }
}
