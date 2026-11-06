/**
 * SameSite=None and secure, since the app runs embedded in Onshape's iframe.
 * Partitioned (CHIPS), so a browser blocking third-party cookies still keeps
 * them, keyed to the top-level site; a delete must carry it too to match.
 */
export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    partitioned: true,
    path: "/"
} as const;
