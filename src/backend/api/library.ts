import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { type AppBindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getAccessLevel, getUserId } from "../onshape-api/endpoints/users";
import {
  libraries,
  documents,
  elements,
  favorites,
  users,
} from "../../shared/schema";
import {
  Library,
  ElementType,
  ThumbnailUrls,
} from "../../frontend/api-utils/client-models";
import { Vendor } from "../../shared/types";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface DocumentPathOut {
  documentId: string;
  instanceId: string;
  instanceType: "v";
}

export interface ElementPathOut extends DocumentPathOut {
  elementId: string;
}

export interface ElementOut {
  id: string;
  documentId: string;
  path: ElementPathOut;
  name: string;
  microversionId: string;
  isVisible: boolean;
  isOpenComposite: boolean;
  supportsFasten: boolean;
  elementType: ElementType;
  thumbnailUrls: ThumbnailUrls;
  configurationId?: string;
  vendors: Vendor[];
}

export interface DocumentOut {
  id: string;
  path: DocumentPathOut;
  name: string;
  sortAlphabetically: boolean;
  thumbnailUrls: ThumbnailUrls;
  elementOrder: string[];
}

export interface LibraryOut {
  documentOrder: string[];
  documents: Record<string, DocumentOut>;
  elements: Record<string, ElementOut>;
}

export interface FavoriteOut {
  id: string;
  defaultConfiguration: Record<string, string> | undefined;
}

export interface LibraryUserDataOut {
  favorites: Record<string, FavoriteOut>;
  favoriteOrder: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAppAccessLevel(
  c: { env: AppBindings },
  onshapeApi: Awaited<ReturnType<typeof getOnshapeApi>>,
): Promise<string> {
  const adminTeam = (c.env as any).ADMIN_TEAM;
  if (!adminTeam) throw new Error("ADMIN_TEAM must be configured");
  return getAccessLevel(onshapeApi, adminTeam);
}

async function requireEditorAccess(c: { env: AppBindings }): Promise<void> {
  const onshapeApi = await getOnshapeApi(c as any);
  const level = await getAppAccessLevel(c, onshapeApi);
  if (level !== "editor" && level !== "admin")
    throw new Error("Insufficient permissions");
}

export async function buildLibraryOut(
  db: ReturnType<typeof getDb>,
  library: Library,
): Promise<LibraryOut> {
  const lib = await db
    .select()
    .from(libraries)
    .where(eq(libraries.id, library))
    .get();
  if (!lib) throw new Error("Library not found");

  const documentOrder: string[] = JSON.parse(lib.documentOrder);

  const allDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.libraryId, library))
    .all();

  const allElements = await db
    .select()
    .from(elements)
    .where(eq(elements.libraryId, library))
    .all();

  const documentsOut: Record<string, DocumentOut> = {};
  for (const doc of allDocuments) {
    documentsOut[doc.id] = {
      id: doc.id,
      path: {
        documentId: doc.id,
        instanceId: doc.instanceId,
        instanceType: "v",
      },
      name: doc.name,
      sortAlphabetically: doc.sortAlphabetically,
      thumbnailUrls: JSON.parse(doc.thumbnailUrls) as ThumbnailUrls,
      elementOrder: JSON.parse(doc.elementOrder),
    };
  }

  const elementsOut: Record<string, ElementOut> = {};
  for (const el of allElements) {
    const doc = allDocuments.find((d) => d.id === el.documentId);
    if (!doc) continue;
    elementsOut[el.id] = {
      id: el.id,
      documentId: el.documentId,
      path: {
        documentId: el.documentId,
        instanceId: doc.instanceId,
        instanceType: "v",
        elementId: el.id,
      },
      name: el.name,
      microversionId: el.microversionId,
      isVisible: el.isVisible,
      isOpenComposite: el.isOpenComposite,
      supportsFasten: el.supportsFasten,
      elementType: el.elementType as ElementType,
      thumbnailUrls: JSON.parse(el.thumbnailUrls) as ThumbnailUrls,
      configurationId: el.configurationId ?? undefined,
      vendors: JSON.parse(el.vendors) as Vendor[],
    };
  }

  return { documentOrder, documents: documentsOut, elements: elementsOut };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const libraryRoutes = new Hono<{ Bindings: AppBindings }>();

/** GET /api/library-data?library=X */
libraryRoutes.get("/library-data", async (c) => {
  const library = c.req.query("library") as Library;
  if (!library) return c.json({ error: "library required" }, 400);

  const db = getDb(c.env.DB);
  const data = await buildLibraryOut(db, library);
  return c.json(data);
});

/** GET /api/search-db?library=X */
libraryRoutes.get("/search-db", async (c) => {
  const library = c.req.query("library") as Library;
  if (!library) return c.json({ error: "library required" }, 400);

  const raw = await c.env.KV.get(`searchdb:${library}`);
  return c.json({ searchDb: raw });
});

/** GET /api/library-user-data?library=X */
libraryRoutes.get("/library-user-data", async (c) => {
  const library = c.req.query("library") as Library;
  if (!library) return c.json({ error: "library required" }, 400);

  const onshapeApi = await getOnshapeApi(c);
  const userId = await getUserId(onshapeApi);

  const db = getDb(c.env.DB);
  const favRows = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.libraryId, library)))
    .orderBy(asc(favorites.sortOrder))
    .all();

  const favoritesOut: Record<string, FavoriteOut> = {};
  const favoriteOrder: string[] = [];

  for (const row of favRows) {
    favoritesOut[row.elementId] = {
      id: row.elementId,
      defaultConfiguration: row.defaultConfiguration
        ? JSON.parse(row.defaultConfiguration)
        : undefined,
    };
    favoriteOrder.push(row.elementId);
  }

  return c.json({
    favorites: favoritesOut,
    favoriteOrder,
  } satisfies LibraryUserDataOut);
});

/** POST /api/library-version/:library */
libraryRoutes.post("/library-version/:library", async (c) => {
  await requireEditorAccess(c);
  const library = c.req.param("library") as Library;
  const body = await c.req.json<{ searchDb: string }>();

  const db = getDb(c.env.DB);

  const lib = await db
    .select({ cacheVersion: libraries.cacheVersion })
    .from(libraries)
    .where(eq(libraries.id, library))
    .get();

  const newVersion = (lib?.cacheVersion ?? 0) + 1;

  await db
    .insert(libraries)
    .values({ id: library, cacheVersion: newVersion })
    .onConflictDoUpdate({
      target: libraries.id,
      set: { cacheVersion: newVersion },
    });

  await c.env.KV.put(`searchdb:${library}`, body.searchDb);

  return c.json({ newVersion });
});

/** POST /api/favorites/:library/users/:userId */
libraryRoutes.post("/favorites/:library/users/:userId", async (c) => {
  const library = c.req.param("library") as Library;
  const userId = c.req.param("userId");
  const elementId = c.req.query("elementId");
  if (!elementId) return c.json({ error: "elementId required" }, 400);

  const db = getDb(c.env.DB);

  await db.insert(users).values({ id: userId }).onConflictDoNothing();

  const existingCount = await db
    .select({ sortOrder: favorites.sortOrder })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.libraryId, library)))
    .all();

  const nextOrder = existingCount.length;

  await db
    .insert(favorites)
    .values({
      userId,
      libraryId: library,
      elementId,
      sortOrder: nextOrder,
    })
    .onConflictDoNothing();

  return c.json({ success: true });
});

/** DELETE /api/favorites/:library/users/:userId */
libraryRoutes.delete("/favorites/:library/users/:userId", async (c) => {
  const library = c.req.param("library") as Library;
  const userId = c.req.param("userId");
  const elementId = c.req.query("elementId");
  if (!elementId) return c.json({ error: "elementId required" }, 400);

  const db = getDb(c.env.DB);
  await db
    .delete(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.libraryId, library),
        eq(favorites.elementId, elementId),
      ),
    );

  return c.json({ success: true });
});

/** POST /api/favorite-order/:library/users/:userId */
libraryRoutes.post("/favorite-order/:library/users/:userId", async (c) => {
  const library = c.req.param("library") as Library;
  const userId = c.req.param("userId");
  const body = await c.req.json<{ favoriteOrder: string[] }>();

  const db = getDb(c.env.DB);
  await Promise.all(
    body.favoriteOrder.map((elementId, i) =>
      db
        .update(favorites)
        .set({ sortOrder: i })
        .where(
          and(
            eq(favorites.userId, userId),
            eq(favorites.libraryId, library),
            eq(favorites.elementId, elementId),
          ),
        ),
    ),
  );

  return c.json({ success: true });
});

/** POST /api/default-configuration/:library/users/:userId */
libraryRoutes.post(
  "/default-configuration/:library/users/:userId",
  async (c) => {
    const library = c.req.param("library") as Library;
    const userId = c.req.param("userId");
    const body = await c.req.json<{
      favoriteId: string;
      defaultConfiguration: Record<string, string>;
    }>();

    const db = getDb(c.env.DB);
    await db
      .update(favorites)
      .set({ defaultConfiguration: JSON.stringify(body.defaultConfiguration) })
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.libraryId, library),
          eq(favorites.elementId, body.favoriteId),
        ),
      );

    return c.json({ success: true });
  },
);
