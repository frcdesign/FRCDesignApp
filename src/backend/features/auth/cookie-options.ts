/** SameSite=None and secure, since the app runs embedded in Onshape's iframe. */
export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
} as const;
