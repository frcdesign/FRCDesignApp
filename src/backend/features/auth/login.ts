/**
 * A sign-in in flight: the OAuth state and where to return, held whole in a
 * ten-minute cookie of its own. Nothing of it is in KV.
 */
import { getCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";
import { clearAuthCookie, setAuthCookie } from "./cookie-options";

const LOGIN_COOKIE = "__Host-frc-design-app-login";
const LOGIN_TTL = 600; // 10 minutes

/** What the callback needs to finish a sign-in it did not start. */
export interface Login {
    state: string;
    redirectUrl: string;
}

/**
 * Held in its own cookie, so a caller who never returns through the callback
 * keeps the session they had. Only the caller's own browser can set it, and the
 * callback checks its state against Onshape's.
 */
export function startLogin(c: AppContext, login: Login): void {
    setAuthCookie(c, LOGIN_COOKIE, JSON.stringify(login), LOGIN_TTL);
}

/** Single-use: reading it also clears it, so a state cannot be replayed. */
export function takeLogin(c: AppContext): Login | undefined {
    const raw = getCookie(c, LOGIN_COOKIE);
    if (!raw) return undefined;
    clearAuthCookie(c, LOGIN_COOKIE);
    try {
        return JSON.parse(raw) as Login;
    } catch {
        return undefined;
    }
}
