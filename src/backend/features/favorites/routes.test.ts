import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { favorites } from "../../db/schema";
import {
    TEST_ASSEMBLY_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedConfiguration,
    seedFavorite,
    seedPartStudio,
    seedTestData
} from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);
const favoritesUrl = `/api/favorites/library/${TEST_LIBRARY_ID}`;

interface FavoritesBody {
    favorites: Record<
        string,
        {
            insertableId: string;
            defaultConfiguration?: Record<string, string>;
            canonicalConfiguration?: string;
        }
    >;
    favoriteOrder: string[];
}

/** The one favorite a body holds, for the derived-canonical tests. */
function soleFavorite(body: FavoritesBody) {
    return body.favorites[body.favoriteOrder[0]];
}

describe("favorites routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    describe("GET /favorites/library/:libraryId", () => {
        it("returns the user's favorites ordered by sortOrder", async () => {
            await seedTestData(db);
            const app = createTestApp();

            const res = await app.request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            expect(res.status).toBe(200);

            const body: FavoritesBody = await res.json();
            const orderedInsertables = body.favoriteOrder.map(
                (id) => body.favorites[id].insertableId
            );
            expect(orderedInsertables).toEqual([
                TEST_PART_STUDIO_ID,
                TEST_ASSEMBLY_ID
            ]);
            // Per-user, and Workers Cache keys ignore cookies.
            expect(res.headers.get("Cache-Control")).toBe("private, no-store");
        });

        // Derived per response rather than stored, so it cannot go stale when a
        // reload changes what the parameters default to.
        it("derives each favorite's canonical form from what it stores", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            await db
                .update(favorites)
                .set({ defaultConfiguration: { boolean: "false" } })
                .where(eq(favorites.id, favoriteId));

            const res = await createTestApp().request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            expect(soleFavorite(await res.json()).canonicalConfiguration).toBe(
                "boolean=false"
            );
        });

        // The whole reason the selection is stored as it was made: canonicalizing
        // drops a value that is the parameter's default, which for a string
        // parameter is text the user typed.
        it("keeps a stored value that canonicalizing drops", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            const defaultConfiguration = { boolean: "true" };
            await db
                .update(favorites)
                .set({ defaultConfiguration })
                .where(eq(favorites.id, favoriteId));

            const res = await createTestApp().request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            const favorite = soleFavorite(await res.json());
            expect(favorite.defaultConfiguration).toEqual(defaultConfiguration);
            // "true" is the parameter default, so it names no override at all.
            expect(favorite.canonicalConfiguration).toBe("");
        });

        it("only returns the current user's favorites", async () => {
            await seedTestData(db);
            await seedFavorite(db, TEST_PART_STUDIO_ID, "other-user");
            const app = createTestApp();

            const res = await app.request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            const body: FavoritesBody = await res.json();
            expect(body.favoriteOrder).toHaveLength(2);
        });
    });

    describe("POST /favorites/library/:libraryId", () => {
        it("creates a favorite with sortOrder = existing count", async () => {
            await seedPartStudio(db);
            await seedAssembly(db);
            await seedFavorite(db, TEST_PART_STUDIO_ID); // one existing favorite

            const app = createTestApp();
            const res = await app.request(
                `${favoritesUrl}?insertableId=${TEST_ASSEMBLY_ID}&id=fav-new`,
                jsonRequest("POST"),
                env
            );
            expect(res.status).toBe(200);

            const row = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-new"))
                .get();
            expect(row?.userId).toBe("test-user");
            expect(row?.insertableId).toBe(TEST_ASSEMBLY_ID);
            expect(row?.sortOrder).toBe(1);
        });

        it("400s when insertableId or id is missing", async () => {
            const app = createTestApp();
            const missingInsertable = await app.request(
                `${favoritesUrl}?id=fav-1`,
                jsonRequest("POST"),
                env
            );
            expect(missingInsertable.status).toBe(400);

            const missingId = await app.request(
                `${favoritesUrl}?insertableId=${TEST_PART_STUDIO_ID}`,
                jsonRequest("POST"),
                env
            );
            expect(missingId.status).toBe(400);
        });

        it("is idempotent on a conflicting id", async () => {
            await seedPartStudio(db);
            const app = createTestApp();
            const url = `${favoritesUrl}?insertableId=${TEST_PART_STUDIO_ID}&id=dup`;

            await app.request(url, jsonRequest("POST"), env);
            await app.request(url, jsonRequest("POST"), env);

            const rows = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "dup"))
                .all();
            expect(rows).toHaveLength(1);
        });
    });

    describe("DELETE /favorite/:favoriteId", () => {
        it("deletes a favorite owned by the current user", async () => {
            await seedPartStudio(db);
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            const app = createTestApp();

            const res = await app.request(
                `/api/favorite/${favoriteId}`,
                jsonRequest("DELETE"),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db.select().from(favorites).all();
            expect(rows).toHaveLength(0);
        });

        it("does not delete a favorite owned by another user", async () => {
            await seedPartStudio(db);
            const favoriteId = await seedFavorite(
                db,
                TEST_PART_STUDIO_ID,
                "other-user"
            );
            const app = createTestApp();

            const res = await app.request(
                `/api/favorite/${favoriteId}`,
                jsonRequest("DELETE"),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db.select().from(favorites).all();
            expect(rows).toHaveLength(1);
        });
    });

    describe("POST /favorite-order/library/:libraryId", () => {
        it("reorders favorites to match the posted order", async () => {
            await seedPartStudio(db);
            await seedAssembly(db);
            const favA = await seedFavorite(
                db,
                TEST_PART_STUDIO_ID,
                "test-user",
                0
            );
            const favB = await seedFavorite(
                db,
                TEST_ASSEMBLY_ID,
                "test-user",
                1
            );
            const app = createTestApp();

            const res = await app.request(
                `/api/favorite-order/library/${TEST_LIBRARY_ID}`,
                jsonRequest("POST", { favoriteOrder: [favB, favA] }),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db
                .select()
                .from(favorites)
                .orderBy(asc(favorites.sortOrder))
                .all();
            expect(rows.map((r) => r.id)).toEqual([favB, favA]);
        });
    });

    describe("POST /default-configuration/favorite/:favoriteId", () => {
        it("persists the selection the favorite opens with", async () => {
            await seedPartStudio(db);
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            const app = createTestApp();

            const defaultConfiguration = { "param-id": "value" };
            const res = await app.request(
                `/api/default-configuration/favorite/${favoriteId}`,
                jsonRequest("POST", { defaultConfiguration }),
                env
            );
            expect(res.status).toBe(200);

            const row = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, favoriteId))
                .get();
            expect(row?.defaultConfiguration).toEqual(defaultConfiguration);
        });
    });
});
