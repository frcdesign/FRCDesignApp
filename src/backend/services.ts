import { type AppServicesFactory } from "./app";
import { getOnshapeApi } from "./auth";
import { getUserId } from "./onshape-api/endpoints/users";
import { getCachedAccessLevel } from "./access-level-cache";
import { type AccessLevel } from "../shared/types";

/**
 * Production dependency wiring: resolves the Onshape API from the session, the
 * userId from session info, and the access level from the user's admin-team
 * membership (honoring the `ACCESS_LEVEL_OVERRIDE` binding, and otherwise
 * KV-cached to keep it off nearly every request).
 */
export const productionServices: AppServicesFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: async () => getUserId(await getOnshapeApi(c)),
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        return getCachedAccessLevel(c);
    }
});
