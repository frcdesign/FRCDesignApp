import { type AppServicesFactory } from "./app";
import { getOnshapeApi } from "./auth";
import { getAccessLevel, getUserId } from "./onshape-api/endpoints/users";
import { type AccessLevel } from "../shared/types";

/**
 * Production dependency wiring: resolves the Onshape API from the session, the
 * userId from session info, and the access level from the user's admin-team
 * membership (honoring the `ACCESS_LEVEL_OVERRIDE` binding).
 */
export const productionServices: AppServicesFactory = (c) => ({
    getOnshapeApi: () => getOnshapeApi(c),
    getUserId: async () => getUserId(await getOnshapeApi(c)),
    getAccessLevel: async () => {
        const override = c.env.ACCESS_LEVEL_OVERRIDE;
        if (override) return override as AccessLevel;
        return getAccessLevel(await getOnshapeApi(c), c.env.ADMIN_TEAM);
    }
});
