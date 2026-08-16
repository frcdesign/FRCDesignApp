import { type AppServicesFactory } from "./app";
import { getCachedUserId, getOnshapeApi, isAuthenticated } from "./auth";
import { getCachedAccessLevel } from "./access-level-utils";
import { isSignedIn } from "./sign-in-utils";
import { AccessLevel } from "../shared/types";

/** Stable fake user id used for FORCE_SIGNED_IN testing sessions. */
export const FORCE_SIGNED_IN_USER_ID = "force-signed-in-user";

/**
 * Production dependency wiring, memoizing the Onshape lookups in KV by session.
 *
 * `getUserId`/`getAccessLevel` also tolerate not-signed-in requests: `getUserId`
 * is only reached behind `requireSignInMiddleware`, and `getAccessLevel` falls
 * back to USER.
 */
export const productionServices: AppServicesFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: () => {
        // FORCE_SIGNED_IN has no real Onshape session; use a stable fake id.
        if (c.env.FORCE_SIGNED_IN) {
            return Promise.resolve(FORCE_SIGNED_IN_USER_ID);
        }
        return getCachedUserId(c);
    },
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        // getCachedAccessLevel needs a real Onshape session, so only call it
        // for a genuinely signed-in caller (not FORCE_SIGNED_IN).
        if (!c.env.FORCE_SIGNED_IN && (await isSignedIn(c))) {
            return getCachedAccessLevel(c);
        }
        return AccessLevel.USER;
    },
    isAuthenticated: () => isAuthenticated(c)
});
