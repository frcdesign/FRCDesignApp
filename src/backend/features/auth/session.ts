/** Session cookie plus the KV records it keys: the session and login state. */
import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";

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

/**
 * Onshape's company id for a session outside an enterprise. It is what
 * `/init` carries for a plain cad.onshape.com user, and it is not a company
 * OAuth will accept.
 */
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
function sessionKey(sessionId: string): string {
    return `tokens:${sessionId}`;
}

/** Keyed by session, so it is dropped along with one. */
export function accessLevelKey(sessionId: string): string {
    return `access-level:${sessionId}`;
}

function loginKey(loginId: string): string {
    return `login-session:${loginId}`;
}

/** Drops what a session id keys; the cookie is the caller's to clear. */
async function dropSession(kv: KVNamespace, sessionId: string): Promise<void> {
    await Promise.all([
        kv.delete(sessionKey(sessionId)),
        kv.delete(accessLevelKey(sessionId))
    ]);
}

/**
 * Signs the caller out: the tokens and what was resolved from them go, and the
 * cookie with them, so the next request is simply a stranger's.
 */
export async function endSession(c: AppContext): Promise<void> {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) {
        await dropSession(c.env.KV, sessionId);
    }
    // Matched to how it was set, or the browser keeps the cookie.
    deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS);
}

/**
 * Puts the caller in a newly signed-in session, and drops the one they came
 * with. The id is minted here rather than at sign-in, so it is only ever
 * replaced by a sign-in that finished, and never carries over one that did not.
 */
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
    await kv.put(sessionKey(sessionId), JSON.stringify(session), {
        expirationTtl: SESSION_TTL
    });
}

export async function getSession(
    kv: KVNamespace,
    sessionId: string
): Promise<Session> {
    const raw = await kv.get(sessionKey(sessionId));
    if (!raw) {
        throw internalError(
            "Failed to find valid auth tokens to use",
            HttpStatus.UNAUTHORIZED
        );
    }
    return JSON.parse(raw) as Session;
}

/** What the callback needs to finish a sign-in it did not start. */
interface LoginSession {
    state: string;
    redirectUrl: string;
}

/** Single-use: reading it also clears it, so a state cannot be replayed. */
export async function takeLoginSession(
    c: AppContext
): Promise<LoginSession | null> {
    const loginId = getCookie(c, LOGIN_COOKIE);
    if (!loginId) return null;
    const raw = await c.env.KV.get(loginKey(loginId));
    if (!raw) return null;

    const session = JSON.parse(raw) as LoginSession;

    deleteCookie(c, LOGIN_COOKIE, COOKIE_OPTIONS);
    void c.env.KV.delete(loginKey(loginId));
    return session;
}

/**
 * Starts an OAuth round trip. It rides its own cookie: `/init` sends a caller
 * here whenever Onshape will not take their session, and one who never comes
 * back through the callback — the sign-in failed, or they closed the panel —
 * keeps the session they arrived with.
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

    await c.env.KV.put(loginKey(loginId), JSON.stringify(data), {
        expirationTtl: LOGIN_TTL
    });
}
