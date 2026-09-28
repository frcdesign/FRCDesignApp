/**
 * A signed-in session. Its cookie holds only an opaque id; the tokens and user
 * it keys stay in KV. The sign-in in flight is `login.ts`'s, and holds nothing
 * here.
 */
import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { COOKIE_OPTIONS } from "./cookie-options";

const SESSION_COOKIE = "frc-design-app-session";
const SESSION_TTL = 30 * 24 * 3600; // 30 days

export function getSessionId(c: AppContext): string {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) {
        throw internalError(
            "Failed to find a valid session",
            HttpStatus.UNAUTHORIZED
        );
    }
    return sessionId;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

/** A signed-in session: what it takes to call Onshape, and who is calling. */
interface Session extends AuthTokens {
    /** Resolved on first use, since signing in never needs to ask. */
    userId?: string;
}

const sessions = kvStore<Session>("session", { ttlSeconds: SESSION_TTL });

export async function endSession(c: AppContext): Promise<void> {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) {
        await sessions.delete(c.env.KV, sessionId);
    }
    // Matched to how it was set, or the browser keeps the cookie.
    deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS);
}

/** Minted here, so a session is only replaced by a sign-in that finished. */
export async function beginSession(
    c: AppContext,
    tokens: AuthTokens
): Promise<void> {
    const previousSessionId = getCookie(c, SESSION_COOKIE);
    const sessionId = crypto.randomUUID();
    setCookie(c, SESSION_COOKIE, sessionId, {
        ...COOKIE_OPTIONS,
        maxAge: SESSION_TTL
    });
    await saveSession(c.env.KV, sessionId, tokens);
    if (previousSessionId) {
        await sessions.delete(c.env.KV, previousSessionId);
    }
}

export async function saveSession(
    kv: KVNamespace,
    sessionId: string,
    session: Session
) {
    await sessions.put(kv, sessionId, session);
}

export async function getSession(
    kv: KVNamespace,
    sessionId: string
): Promise<Session> {
    const session = await sessions.get(kv, sessionId);
    if (!session) {
        throw internalError(
            "Failed to find valid auth tokens to use",
            HttpStatus.UNAUTHORIZED
        );
    }
    return session;
}
