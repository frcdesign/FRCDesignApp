import { eq } from "drizzle-orm";
import { getApp } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getUserId } from "../onshape-api/endpoints/users";
import { getAppAccessLevel } from "../access-level-utils";
import { users, libraries } from "../../shared/schema";
import { Library, ContextData, Theme } from "../../shared/types";

export const userRoutes = getApp();

/** GET /api/context-data */
userRoutes.get("/context-data", async (c) => {
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);

    const [maxAccessLevel, db] = await Promise.all([
        getAppAccessLevel(c),
        Promise.resolve(getDb(c.env.DB))
    ]);

    let user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
        user = {
            id: userId,
            theme: Theme.SYSTEM,
            library: Library.FRC_DESIGN_LIB
        };
    }

    const lib = await db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, user.library))
        .get();

    return c.json({
        accessData: {
            maxAccessLevel,
            currentAccessLevel: maxAccessLevel,
            cacheVersion: lib?.cacheVersion ?? 0
        },
        settings: {
            theme: user.theme,
            library: user.library
        }
    } satisfies ContextData);
});

/** POST /api/user-data — update settings */
userRoutes.post("/user-data", async (c) => {
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);

    const body = await c.req.json<{ theme?: Theme; library?: Library }>();

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    if (Object.keys(body).length > 0) {
        await db.update(users).set(body).where(eq(users.id, userId));
    }

    return c.json({ success: true });
});
