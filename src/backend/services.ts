import { type AppServicesFactory } from "./app";
import { getCachedUserId, getOnshapeApi } from "./auth";
import { getCachedAccessLevel } from "./access-level-utils";
import { type AccessLevel } from "../shared/types";

/**
 * Production dependency wiring: resolves the Onshape API from the session, and
 * the userId and access level from the caller's Onshape account (both memoized
 * in KV by session; the access level also honors the override).
 */
export const productionServices: AppServicesFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: () => getCachedUserId(c),
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        return getCachedAccessLevel(c);
    }
});
