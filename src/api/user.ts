import { createServerFn } from "@tanstack/react-start";
import { Library, Theme } from "../api-utils/client-models";
import { OAuthClient } from "../onshape-api/client/oauth-client";
import {
    AccessLevel,
    getAccessLevel,
    getUserId
} from "../onshape-api/endpoints/users";
import { getLibrary } from "../connect/library";
import { getUser } from "../connect/user";
import { getAuthSession } from "../routes/auth/-auth";
import { UserData } from "../connect/db-models";

// --- Output types ---

export interface ContextDataOut {
    maxAccessLevel: AccessLevel;
    currentAccessLevel: AccessLevel;
    cacheVersion: number;
}

// --- Server-side helpers ---

async function getClient(): Promise<OAuthClient> {
    const session = await getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return new OAuthClient(session.accessToken);
}

async function getAppAccessLevel(client: OAuthClient): Promise<AccessLevel> {
    const override = process.env.ACCESS_LEVEL_OVERRIDE;
    if (override) return override as AccessLevel;

    const adminTeam = process.env.ADMIN_TEAM;
    if (!adminTeam)
        throw new Error(
            "ADMIN_TEAM or ACCESS_LEVEL_OVERRIDE must be configured"
        );

    return getAccessLevel(client, adminTeam);
}

// --- Server functions ---

/** Returns the current user's access level and the library's cache version. */
export const fetchContextData = createServerFn()
    .inputValidator((data: { library: Library }) => data)
    .handler(async ({ data: { library } }): Promise<ContextDataOut> => {
        const client = await getClient();
        const maxAccessLevel = await getAppAccessLevel(client);
        const currentAccessLevel =
            process.env.NODE_ENV === "production"
                ? AccessLevel.USER
                : maxAccessLevel;

        const libraryData = await getLibrary(library).get();
        if (!libraryData) throw new Error("Library not found");

        return {
            maxAccessLevel,
            currentAccessLevel,
            cacheVersion: libraryData.cacheVersion
        };
    });

/** Returns the current user's stored data. */
export const fetchUserData = createServerFn().handler(
    async (): Promise<UserData> => {
        const client = await getClient();
        const userId = await getUserId(client);
        const userData = await getUser(userId).get();
        if (!userData) throw new Error("User data not found");
        return userData;
    }
);

/** Updates one or more of the current user's settings. */
export const updateSettings = createServerFn()
    .inputValidator((data: { theme?: Theme; library?: Library }) => data)
    .handler(async ({ data: { theme, library } }) => {
        const client = await getClient();
        const userId = await getUserId(client);

        const updates: Record<string, unknown> = {};
        if (theme !== undefined) updates["settings.theme"] = theme;
        if (library !== undefined) updates["settings.library"] = library;

        if (Object.keys(updates).length > 0) {
            await getUser(userId).ref.update(updates);
        }

        return { success: true };
    });
