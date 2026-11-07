/** How the auth cookies are written, so every write and delete matches. */
import { deleteCookie, setCookie } from "hono/cookie";
import { type AppContext } from "../../lib/context";

/**
 * SameSite=None and secure, since the app runs embedded in Onshape's iframe.
 * Partitioned (CHIPS), so a browser blocking third-party cookies still keeps
 * them, keyed to the top-level site.
 */
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    partitioned: true,
    path: "/"
} as const;

/**
 * One Set-Cookie per name per response: Firefox's Total Cookie Protection
 * partitions a frame's cookies whatever the attribute says, so a second for
 * the same name lands on the same cookie.
 */
export function setAuthCookie(
    c: AppContext,
    name: string,
    value: string,
    maxAge: number
): void {
    setCookie(c, name, value, { ...COOKIE_OPTIONS, maxAge });
}

export function clearAuthCookie(c: AppContext, name: string): void {
    deleteCookie(c, name, COOKIE_OPTIONS);
}

/** For logs and reports: which cookies arrived, never their values. */
export function cookieNames(c: AppContext): string[] {
    return (c.req.header("Cookie") ?? "")
        .split(";")
        .map((pair) => pair.split("=")[0].trim())
        .filter((name) => name.length > 0);
}
