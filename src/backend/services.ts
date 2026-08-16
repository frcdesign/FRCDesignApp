import { type AppServicesFactory } from "./app";
import { getCachedUserId, getOnshapeApi, isAuthenticated } from "./auth";
import { getCachedAccessLevel } from "./access-level-utils";
import { type AccessLevel } from "../shared/types";

/** Production dependency wiring, memoizing the Onshape lookups in KV by session. */
export const productionServices: AppServicesFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: () => getCachedUserId(c),
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        return getCachedAccessLevel(c);
    },
    isAuthenticated: () => isAuthenticated(c)
});
