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
 * An unpartitioned cookie of the same name is a separate cookie, sent ahead of
 * ours when older, and `getCookie` reads the first: every write expires it.
 */
const UNPARTITIONED_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
} as const;

export function setAuthCookie(
    c: AppContext,
    name: string,
    value: string,
    maxAge: number
): void {
    setCookie(c, name, value, { ...COOKIE_OPTIONS, maxAge });
    deleteCookie(c, name, UNPARTITIONED_OPTIONS);
}

export function clearAuthCookie(c: AppContext, name: string): void {
    deleteCookie(c, name, COOKIE_OPTIONS);
    deleteCookie(c, name, UNPARTITIONED_OPTIONS);
}

/** More than one is a partitioned and an unpartitioned copy, of which only the first is read. */
export function countCookies(c: AppContext, name: string): number {
    return (c.req.header("Cookie") ?? "")
        .split(";")
        .filter((pair) => pair.trim().startsWith(`${name}=`)).length;
}

/** For logs: which cookies arrived, never their values. */
export function cookieNames(c: AppContext): string[] {
    return (c.req.header("Cookie") ?? "")
        .split(";")
        .map((pair) => pair.split("=")[0].trim())
        .filter((name) => name.length > 0);
}
