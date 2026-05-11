import { Timestamp } from "@google-cloud/firestore";
import { OAuth2Client, OAuth2Tokens } from "arctic";
import { DB } from "../../connect/db";

// SameSite=None + Secure required because the app runs embedded in an Onshape iframe.
export const COOKIE_BASE = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/"
};

// Encrypted cookie used to carry OAuth state (state param + redirectUrl) across
// the authorization redirect. Short TTL — only needs to survive the round trip.
export const OAUTH_SESSION_CONFIG = {
    password: process.env.SESSION_SECRET!,
    name: "oauth-state",
    maxAge: 600,
    cookie: COOKIE_BASE
};

export interface OAuthSessionData {
    state: string;
    redirectUrl: string;
}

// --- Session management ---

export interface AuthSession {
    sessionId: string;
    accessToken: string;
    refreshToken: string | null;
}

export const onshapeClient = new OAuth2Client(
    process.env.OAUTH_CLIENT_ID!,
    process.env.OAUTH_CLIENT_SECRET!,
    null
);
export async function createSession(tokens: OAuth2Tokens): Promise<string> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await DB.collection("sessions")
        .doc(sessionId)
        .set({
            accessToken: tokens.accessToken(),
            refreshToken: tokens.hasRefreshToken()
                ? tokens.refreshToken()
                : null,
            expiresAt: Timestamp.fromDate(expiresAt),
            createdAt: Timestamp.now()
        });
    return sessionId;
}
export async function getSession(
    sessionId: string
): Promise<AuthSession | null> {
    const doc = await DB.collection("sessions").doc(sessionId).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    if ((data.expiresAt as Timestamp).toDate() < new Date()) return null;

    return {
        sessionId,
        accessToken: data.accessToken as string,
        refreshToken: (data.refreshToken as string | null) ?? null
    };
}
export const SESSION_COOKIE = "auth-session";
