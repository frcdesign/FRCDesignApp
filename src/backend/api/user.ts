import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { type Bindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getAccessLevel, getUserId } from "../onshape-api/endpoints/users";
import { users, libraries } from "../../shared/schema";
import { Library, Theme } from "../../frontend/api-utils/client-models";

export { AccessLevel } from "../onshape-api/endpoints/users";

export interface ContextDataOut {
  maxAccessLevel: string;
  currentAccessLevel: string;
  cacheVersion: number;
}

export interface UserDataOut {
  settings: {
    theme: Theme;
    library: Library;
  };
}

export const userRoutes = new Hono<{ Bindings: Bindings }>();

async function getAppAccessLevel(c: { env: Bindings }): Promise<string> {
  const override = (c.env as any).ACCESS_LEVEL_OVERRIDE;
  if (override) return override as string;

  const adminTeam = (c.env as any).ADMIN_TEAM;
  if (!adminTeam)
    throw new Error("ADMIN_TEAM or ACCESS_LEVEL_OVERRIDE must be configured");

  const onshapeApi = await getOnshapeApi(c as any);
  return getAccessLevel(onshapeApi, adminTeam);
}

/** GET /api/context-data?library=X */
userRoutes.get("/context-data", async (c) => {
  const library = c.req.query("library") as Library;
  if (!library) return c.json({ error: "library required" }, 400);

  const maxAccessLevel = await getAppAccessLevel(c);
  const currentAccessLevel = maxAccessLevel;

  const db = getDb(c.env.DB);
  const lib = await db
    .select({ cacheVersion: libraries.cacheVersion })
    .from(libraries)
    .where(eq(libraries.id, library))
    .get();

  return c.json({
    maxAccessLevel,
    currentAccessLevel,
    cacheVersion: lib?.cacheVersion ?? 0,
  } satisfies ContextDataOut);
});

/** GET /api/user-data */
userRoutes.get("/user-data", async (c) => {
  const onshapeApi = await getOnshapeApi(c);
  const userId = await getUserId(onshapeApi);

  const db = getDb(c.env.DB);
  let user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    await db.insert(users).values({ id: userId }).onConflictDoNothing();
    user = { id: userId, theme: "system", library: "frc-design-lib" };
  }

  return c.json({
    settings: {
      theme: user.theme as Theme,
      library: user.library as Library,
    },
  } satisfies UserDataOut);
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
      library: body.library ?? "frc-design-lib",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        ...(body.theme !== undefined && { theme: body.theme }),
        ...(body.library !== undefined && { library: body.library }),
      },
    });

  return c.json({ success: true });
});
