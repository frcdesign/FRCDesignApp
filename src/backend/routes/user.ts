import { eq } from "drizzle-orm";
import { getApp } from "../app";
import { getDb } from "../db";
import { users, libraries } from "../../shared/schema";
import {
    LibraryId,
    ContextData,
    Theme,
    AccessLevel,
    DEFAULT_SETTINGS
} from "../../shared/types";
import { isSignedIn, requireSignInMiddleware } from "../sign-in-utils";
import { env } from "process";

export const userRoutes = getApp();

async function getLibraryCacheVersion(
    db: ReturnType<typeof getDb>,
    libraryId: LibraryId
): Promise<number> {
    const lib = await db
        .select({ cacheVersion: libraries.cacheVersion })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .get();
    return lib?.cacheVersion ?? 0;
}

/** GET /api/context-data */
userRoutes.get("/context-data", async (c) => {
    const db = getDb(c.env.DB);

    // A not-signed-in caller has no user row; serve defaults so the read-only UI
    // still loads. Settings are then overlaid from localStorage on the client.
    if (!(await isSignedIn(c))) {
        return c.json({
            accessData: {
                maxAccessLevel: AccessLevel.USER,
                currentAccessLevel: AccessLevel.USER,
                cacheVersion: await getLibraryCacheVersion(
                    db,
                    DEFAULT_SETTINGS.libraryId
                )
            },
            settings: DEFAULT_SETTINGS,
            signedIn: false
        } satisfies ContextData);
    }

    const userId = await c.var.getUserId();
    const maxAccessLevel = await c.var.getAccessLevel();

    let user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
        user = {
            id: userId,
            theme: Theme.SYSTEM,
            libraryId: LibraryId.FRC_DESIGN_LIB
        };
    }

    const cacheVersion = await getLibraryCacheVersion(db, user.libraryId);

    // Always default to user in dev and the max in production
    const currentAccessLevel =
        env.NODE_ENV === "production" ? AccessLevel.USER : maxAccessLevel;

    return c.json({
        accessData: {
            maxAccessLevel,
            currentAccessLevel,
            cacheVersion
        },
        settings: {
            theme: user.theme,
            libraryId: user.libraryId
        },
        signedIn: true
    } satisfies ContextData);
});

/** POST /api/user-data — update settings */
userRoutes.post("/user-data", requireSignInMiddleware, async (c) => {
    const userId = await c.var.getUserId();

    const body = await c.req.json<{ theme?: Theme; libraryId?: LibraryId }>();

    const db = getDb(c.env.DB);

    await db.insert(users).values({ id: userId }).onConflictDoNothing();

    if (Object.keys(body).length > 0) {
        await db.update(users).set(body).where(eq(users.id, userId));
    }

    return c.json({ success: true });
});
