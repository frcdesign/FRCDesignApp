import { OnshapeClient } from "../client/client";
import { OAuthClient } from "../client/oauth-client";
import { apiPath } from "../api-path";

export function getSessionInfo(client: OAuthClient): Promise<any> {
    return client.get(
        apiPath("users", undefined, undefined, { endRoute: "sessioninfo" })
    );
}

/** Returns the user ID associated with the current session. */
export function getUserId(client: OAuthClient): Promise<string> {
    return getSessionInfo(client).then((info) => info.id);
}

/**
 * Pings the Onshape API's `users/sessioninfo` endpoint.
 *
 * Returns `true` if the ping was successful.
 *
 * @param catchErrors True to return `false` in place of any thrown exceptions.
 */
export async function ping(
    client: OAuthClient,
    catchErrors = false
): Promise<boolean> {
    try {
        await getSessionInfo(client);
        return true;
    } catch (error) {
        if (catchErrors) return false;
        throw error;
    }
}

export enum AccessLevel {
    MEMBER = "member",
    ADMIN = "admin",
    USER = "user"
}

/** Returns the access level of the authenticated user relative to a given team. */
export async function getAccessLevel(
    client: OnshapeClient,
    teamId: string
): Promise<AccessLevel> {
    try {
        const teamInfo = await client.get(
            apiPath("teams", undefined, undefined, { endId: teamId })
        );
        if (teamInfo.admin) return AccessLevel.ADMIN;
        if (teamInfo.member) return AccessLevel.MEMBER;
        return AccessLevel.USER;
    } catch {
        // Onshape returns an error for teams the user isn't a member of
        return AccessLevel.USER;
    }
}
