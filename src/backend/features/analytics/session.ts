/**
 * The app session an event belongs to: one panel open, minted at `/init` and
 * carried by a cookie so every insert after it correlates back.
 *
 * Distinct from the auth session in `features/auth/session.ts`, which lasts 30
 * days and answers who the caller is. This one answers which visit they are on.
 */
import { getCookie, setCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";

const APP_SESSION_COOKIE = "frc-design-app-session";

/** Long enough to outlast a working session with the panel left open. */
const APP_SESSION_TTL = 12 * 3600;

/**
 * Starts the session `/init` is opening, replacing whatever the last open left.
 * Returns the id so the open itself can be logged against it.
 */
export function startAppSession(c: AppContext): string {
    const sessionId = crypto.randomUUID();
    // SameSite=None + secure, as the auth cookie is: the app runs in an
    // Onshape iframe, and a Lax cookie is not sent from one.
    setCookie(c, APP_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/",
        maxAge: APP_SESSION_TTL
    });
    return sessionId;
}

/**
 * The session the caller is on, or null when there is none to read — a client
 * that predates the cookie, or a browser that refused it.
 */
export function getAppSessionId(c: AppContext): string | null {
    return getCookie(c, APP_SESSION_COOKIE) ?? null;
}
