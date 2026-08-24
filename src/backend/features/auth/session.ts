/** Session cookie plus the KV records it keys: the session and login state. */
import { HttpStatus } from "http-status-ts";
import { internalError } from "../../lib/api-error";
import { getCookie, setCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";

const SESSION_COOKIE = "frc-design-app-cookie";
const LOGIN_TTL = 600; // 10 minutes
export const SESSION_TTL = 30 * 24 * 3600; // 30 days

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

export function getSessionCompanyId(c: AppContext) {
    return c.req.query("sessionCompanyId") ?? "cad";
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

/** A signed-in session: what it takes to call Onshape, and who is calling. */
export interface Session extends AuthTokens {
    /** Resolved on first use, since signing in never needs to ask. */
    userId?: string;
}

/** Still `tokens:`, so sessions signed in before this held a userId survive. */
function sessionKey(sessionId: string): string {
    return `tokens:${sessionId}`;
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
export interface LoginSession {
    state: string;
    redirectUrl: string;
}

/** Single-use: reading it also clears it, so a state cannot be replayed. */
export async function takeLoginSession(
    c: AppContext
): Promise<(LoginSession & { sessionId: string }) | null> {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) return null;
    const raw = await c.env.KV.get(`login-session:${sessionId}`);
    if (!raw) return null;

    const session = JSON.parse(raw);
    session.sessionId = sessionId;

    void c.env.KV.delete(`login-session:${sessionId}`);
    return session;
}

export async function startLoginSession(
    c: AppContext,
    data: LoginSession
): Promise<string> {
    const sessionId = crypto.randomUUID();
    // SameSite=none + secure required because the app runs embedded in an Onshape iframe
    setCookie(c, SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/",
        maxAge: SESSION_TTL
    });

    await c.env.KV.put(`login-session:${sessionId}`, JSON.stringify(data), {
        expirationTtl: LOGIN_TTL
    });
    return sessionId;
}
