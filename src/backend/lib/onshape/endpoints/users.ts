import { OAuthApi } from "../client";

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
