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
            defaultSelection?: Record<string, string>;
            configurationKey?: string;
        }
    >;
    favoriteOrder: string[];
}

/** The one favorite a body holds, for the derived-key tests. */
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
        it("derives each favorite's key from the selection it stores", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            await db
                .update(favorites)
                .set({ defaultSelection: { boolean: "false" } })
                .where(eq(favorites.id, favoriteId));

            const res = await createTestApp().request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            expect(soleFavorite(await res.json()).configurationKey).toBe(
                "boolean=false"
            );
        });

        // The selection is what the favorite opens with, so it keeps a value
        // the key drops for matching the parameter's default.
        it("answers with a whole selection, not only its overrides", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            const configuration = { boolean: "true" };
            await db
                .update(favorites)
                .set({ defaultSelection: configuration })
                .where(eq(favorites.id, favoriteId));

            const res = await createTestApp().request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            const favorite = soleFavorite(await res.json());
            expect(favorite.defaultSelection).toEqual(configuration);
            // "true" is the parameter default, so it names no override at all.
            expect(favorite.configurationKey).toBe("");
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

        it("stamps createdAt, leaving rows that predate the column null", async () => {
            await seedPartStudio(db);
            await seedAssembly(db);
            // Seeded without a timestamp, as every row predating the column
            // looks.
            const old = await seedFavorite(db, TEST_PART_STUDIO_ID);

            const app = createTestApp();
            const before = Date.now();
            await app.request(
                `${favoritesUrl}?insertableId=${TEST_ASSEMBLY_ID}&id=fav-stamped`,
                jsonRequest("POST"),
                env
            );

            const rows = await db.select().from(favorites).all();
            const stamped = rows.find((row) => row.id === "fav-stamped");
            expect(stamped?.createdAt).toBeGreaterThanOrEqual(before);
            expect(rows.find((row) => row.id === old)?.createdAt).toBeNull();
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

    describe("POST /default-selection/favorite/:favoriteId", () => {
        async function post(selection: Record<string, string>) {
            const favoriteId = await seedFavorite(db, TEST_PART_STUDIO_ID);
            const res = await createTestApp().request(
                `/api/default-selection/favorite/${favoriteId}`,
                jsonRequest("POST", { selection }),
                env
            );
            expect(res.status).toBe(200);
            const row = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, favoriteId))
                .get();
            return row?.defaultSelection;
        }

        it("persists the selection the favorite opens with", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);

            expect(await post({ boolean: "false" })).toEqual({
                boolean: "false"
            });
        });

        // Stored as a selection, so what is written is what the insertable
        // declares — not whatever the request happened to name.
        it("drops a value for a parameter the insertable does not have", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);

            expect(await post({ "param-id": "value" })).toEqual({
                boolean: "true"
            });
        });
    });
});
