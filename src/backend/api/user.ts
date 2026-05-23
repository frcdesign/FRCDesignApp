import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { AppContext, type AppBindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getAccessLevel, getUserId } from "../onshape-api/endpoints/users";
import { users, libraries, favorites } from "../../shared/schema";
import {
    Favorite,
    Favorites,
    FavoritesData
} from "../../frontend/api-utils/client-models";
import { Library } from "../../shared/types";
import { AccessLevel, ContextData, Theme } from "../../shared/types";
import { env } from "cloudflare:workers";

export const userRoutes = new Hono<{ Bindings: AppBindings }>();

async function getAppAccessLevel(c: AppContext): Promise<AccessLevel> {
    const override = env.ACCESS_LEVEL_OVERRIDE;
    if (override) return override as AccessLevel;

    const onshapeApi = await getOnshapeApi(c);
    return getAccessLevel(onshapeApi, "TODO: GET ADMIN TEAM ID HERE I GUESS");
}

async function getFavorites(
    db: ReturnType<typeof getDb>,
    userId: string,
    library: Library
): Promise<FavoritesData> {
    const rows = await db
        .select()
        .from(favorites)
        .where(
            and(eq(favorites.userId, userId), eq(favorites.libraryId, library))
        )
        .orderBy(asc(favorites.sortOrder))
        .all();

    const favoritesOut: Favorites = {};
    const favoriteOrder: string[] = [];
    for (const row of rows) {
        favoritesOut[row.insertableId] = {
            id: row.insertableId,
            library,
            defaultConfiguration: row.defaultConfiguration ?? undefined
        } satisfies Favorite;
        favoriteOrder.push(row.insertableId);
    }
    return { favorites: favoritesOut, favoriteOrder };
}

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
        await db.insert(users).values({ id: userId }).onConflictDoNothing();
        user = { id: userId, theme: "system", library: "frc-design-lib" };
    }

    const library = user.library as Library;
    const lib = await db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, library))
        .get();

    return c.json({
        accessData: {
            maxAccessLevel,
            currentAccessLevel: maxAccessLevel,
            cacheVersion: lib?.cacheVersion ?? 0
        },
        settings: {
            theme: user.theme as Theme,
            library
        }
    } satisfies ContextData);
});

/** GET /api/favorites/:library */
userRoutes.get("/favorites/:library", async (c) => {
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);
    const library = c.req.param("library") as Library;

    const db = getDb(c.env.DB);
    return c.json(await getFavorites(db, userId, library));
});

/** POST /api/user-data — update settings */
userRoutes.post("/user-data", async (c) => {
    const onshapeApi = await getOnshapeApi(c);
    const userId = await getUserId(onshapeApi);

    const body = await c.req.json<{ theme?: Theme; library?: Library }>();

    const db = getDb(c.env.DB);

    await db
        .insert(users)
        .values({
            id: userId,
            theme: body.theme ?? "system",
            library: body.library ?? "frc-design-lib"
        })
        .onConflictDoUpdate({
            target: users.id,
            set: {
                ...(body.theme !== undefined && { theme: body.theme }),
                ...(body.library !== undefined && { library: body.library })
            }
        });

    return c.json({ success: true });
});
