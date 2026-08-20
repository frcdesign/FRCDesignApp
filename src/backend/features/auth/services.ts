import type { AppServicesFactory } from "../../lib/context";
import {
    getCachedUserId,
    getOnshapeApi,
    isAuthenticated
} from "./onshape-oauth";
import { getCachedAccessLevel } from "./access-control";
import { isForceSignedIn, isSignedIn } from "./sign-in";
import { AccessLevel } from "./access-level";

/** Stable fake user id used for FORCE_SIGNED_IN testing sessions. */
export const FORCE_SIGNED_IN_USER_ID = "force-signed-in-user";

/**
 * Production dependency wiring, memoizing the Onshape lookups in KV by session.
 * getUserId only runs behind requireSignInMiddleware; getAccessLevel falls back to USER.
 */
export const productionServices: AppServicesFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: () => {
        // FORCE_SIGNED_IN has no real Onshape session; use a stable fake id.
        if (isForceSignedIn(c)) {
            return Promise.resolve(FORCE_SIGNED_IN_USER_ID);
        }
        return getCachedUserId(c);
    },
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        // getCachedAccessLevel needs a real Onshape session, so only call it
        // for a genuinely signed-in caller (not FORCE_SIGNED_IN).
        if (!isForceSignedIn(c) && (await isSignedIn(c))) {
            return getCachedAccessLevel(c);
        }
        return AccessLevel.USER;
    },
    isAuthenticated: () => isAuthenticated(c)
});
