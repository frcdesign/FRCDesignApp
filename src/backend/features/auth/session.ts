/** Session cookie plus the KV records it keys: the session and login state. */
import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";

const SESSION_COOKIE = "frc-design-app-cookie";
/** Held only for the OAuth round trip, so an abandoned one costs the session nothing. */
const LOGIN_COOKIE = "frc-design-app-login";
const LOGIN_TTL = 600; // 10 minutes
const SESSION_TTL = 30 * 24 * 3600; // 30 days

/** SameSite=None + secure required because the app runs embedded in an Onshape iframe. */
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
} as const;

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

/** What `/init` carries outside an enterprise. OAuth won't accept it as a company. */
export const PERSONAL_COMPANY_ID = "cad";

export function getSessionCompanyId(c: AppContext) {
    return c.req.query("sessionCompanyId") ?? PERSONAL_COMPANY_ID;
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

/** Still `tokens:`, so sessions signed in before this held a userId survive. */
const sessions = kvStore<Session>("tokens", { ttlSeconds: SESSION_TTL });

/** The cookie is the caller's to clear. */
function dropSession(kv: KVNamespace, sessionId: string): Promise<void> {
    return sessions.delete(kv, sessionId);
}

export async function endSession(c: AppContext): Promise<void> {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) {
        await dropSession(c.env.KV, sessionId);
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
        await dropSession(c.env.KV, previousSessionId);
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

/** What the callback needs to finish a sign-in it did not start. */
interface LoginSession {
    state: string;
    redirectUrl: string;
}

const loginSessions = kvStore<LoginSession>("login-session", {
    ttlSeconds: LOGIN_TTL
});

/** Single-use: reading it also clears it, so a state cannot be replayed. */
export async function takeLoginSession(
    c: AppContext
): Promise<LoginSession | undefined> {
    const loginId = getCookie(c, LOGIN_COOKIE);
    if (!loginId) return undefined;
    const session = await loginSessions.get(c.env.KV, loginId);
    if (!session) return undefined;

    deleteCookie(c, LOGIN_COOKIE, COOKIE_OPTIONS);
    void loginSessions.delete(c.env.KV, loginId);
    return session;
}

/**
 * On its own cookie, so a caller who never returns through the callback keeps
 * the session they had.
 */
export async function startLoginSession(
    c: AppContext,
    data: LoginSession
): Promise<void> {
    const loginId = crypto.randomUUID();
    setCookie(c, LOGIN_COOKIE, loginId, {
        ...COOKIE_OPTIONS,
        maxAge: LOGIN_TTL
    });

    await loginSessions.put(c.env.KV, loginId, data);
}
