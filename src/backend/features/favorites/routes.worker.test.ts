import {
    type ConfigurationKey,
    type SearchRecord
} from "../configurations/contract";
import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { configurations, favorites, insertables } from "../../db/schema";
import { ElementType } from "../../lib/onshape/element-type";
import { MAX_FAVORITES } from "./contract";
import { ApiErrorKind } from "../../lib/api-error";
import {
    TEST_ASSEMBLY_ID,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedConfiguration,
    seedFavorite,
    seedGroup,
    seedPartStudio,
    seedUser,
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
            configurationKey?: ConfigurationKey;
            record?: SearchRecord;
        }
    >;
    favoriteOrder: string[];
}

/**
 * Rows straight in, since the route under test is the one being filled up. One
 * insertable apiece: a favorite is unique per user, library and insertable.
 */
async function fillFavorites(howMany: number) {
    const db = getDb(env.DB);
    await seedGroup(db);
    await seedUser(db, "test-user", TEST_LIBRARY_ID);

    const rows = Array.from({ length: howMany }, (_, i) => ({
        id: `filler-${i}`,
        insertableId: `filler-insertable-${i}`,
        sortOrder: i
    }));
    // D1 binds at most 100 parameters per query, and an insertable row spends
    // sixteen of them, so these go in small chunks rather than one statement.
    for (const chunk of inChunks(rows, 6)) {
        await db.insert(insertables).values(
            chunk.map((row) => ({
                id: row.insertableId,
                elementId: `filler-element-${row.sortOrder}`,
                groupId: TEST_GROUP_ID,
                documentId: "doc-test",
                libraryId: TEST_LIBRARY_ID,
                name: `Filler ${row.sortOrder}`,
                elementType: ElementType.PART_STUDIO,
                microversionId: "m-1",
                versionId: "v-test"
            }))
        );
        await db.insert(favorites).values(
            chunk.map((row) => ({
                ...row,
                userId: "test-user",
                libraryId: TEST_LIBRARY_ID
            }))
        );
    }
}

function inChunks<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let at = 0; at < items.length; at += size) {
        chunks.push(items.slice(at, at + size));
    }
    return chunks;
}

async function countFavorites(): Promise<number> {
    const rows = await getDb(env.DB).select().from(favorites).all();
    return rows.length;
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

        // The row's thumbnail is this configuration's, so its part number has
        // to be too — resolving it from anything else shows two parts at once.
        it("resolves the record its own selection produces", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            await db
                .update(configurations)
                .set({
                    // The favorite's own record listed second, so picking the
                    // first would answer with the default instead.
                    records: [
                        {
                            configurationKey: "",
                            partNumber: "WCP-2222",
                            name: "Default",
                            hasMultipleParts: false,
                            isOpenComposite: false
                        },
                        {
                            configurationKey: "boolean=false",
                            partNumber: "WCP-1111",
                            name: "Plain",
                            hasMultipleParts: false,
                            isOpenComposite: false
                        }
                    ]
                })
                .where(eq(configurations.insertableId, TEST_PART_STUDIO_ID));
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
            const favorite = soleFavorite(await res.json());
            expect(favorite.configurationKey).toBe("boolean=false");
            expect(favorite.record?.partNumber).toBe("WCP-1111");
            expect(favorite.record?.name).toBe("Plain");
        });

        // A favorite saved with no selection of its own opens on the element's
        // defaults, so that is the record it has to name.
        it("resolves the default record for a favorite with no selection", async () => {
            await seedPartStudio(db);
            await seedConfiguration(db);
            await db
                .update(configurations)
                .set({
                    records: [
                        {
                            configurationKey: "boolean=false",
                            partNumber: "WCP-1111",
                            hasMultipleParts: false,
                            isOpenComposite: false
                        },
                        {
                            configurationKey: "",
                            partNumber: "WCP-2222",
                            hasMultipleParts: false,
                            isOpenComposite: false
                        }
                    ]
                })
                .where(eq(configurations.insertableId, TEST_PART_STUDIO_ID));
            await seedFavorite(db, TEST_PART_STUDIO_ID);

            const res = await createTestApp().request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            const favorite = soleFavorite(await res.json());
            expect(favorite.configurationKey).toBeUndefined();
            expect(favorite.record?.partNumber).toBe("WCP-2222");
        });

        // An insertable with nothing to configure has no configurations row at
        // all; the join has to answer that as no record rather than throwing.
        it("has no record for an insertable with no configuration", async () => {
            await seedPartStudio(db);
            await seedFavorite(db, TEST_PART_STUDIO_ID);

            const res = await createTestApp().request(
                favoritesUrl,
                jsonRequest("GET"),
                env
            );
            expect(res.status).toBe(200);
            expect(soleFavorite(await res.json()).record).toBeUndefined();
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
        it("creates a favorite after the highest order taken", async () => {
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

        // Counting instead would reuse an order a live favorite still holds,
        // and the two would then sort against each other arbitrarily.
        it("does not reuse an order after one is deleted from the middle", async () => {
            await fillFavorites(3);
            await seedPartStudio(db);
            await db.delete(favorites).where(eq(favorites.id, "filler-1"));

            const app = createTestApp();
            const res = await app.request(
                `${favoritesUrl}?insertableId=${TEST_PART_STUDIO_ID}&id=fav-new`,
                jsonRequest("POST"),
                env
            );
            expect(res.status).toBe(200);

            const orders = (await db.select().from(favorites).all()).map(
                (row) => row.sortOrder
            );
            expect(new Set(orders).size).toBe(orders.length);
            expect(Math.max(...orders)).toBe(3);
        });

        it("refuses one past the cap, and says so in words", async () => {
            await seedPartStudio(db);
            await seedAssembly(db);
            await fillFavorites(MAX_FAVORITES);

            const app = createTestApp();
            const res = await app.request(
                `${favoritesUrl}?insertableId=${TEST_ASSEMBLY_ID}&id=fav-past-cap`,
                jsonRequest("POST"),
                env
            );

            expect(res.status).toBe(409);
            // Handled, so the client shows this rather than its own wording.
            expect(await res.json<unknown>()).toMatchObject({
                kind: ApiErrorKind.HANDLED,
                message: expect.stringContaining(String(MAX_FAVORITES))
            });
            expect(await countFavorites()).toBe(MAX_FAVORITES);
        });

        it("still takes the one that lands exactly on the cap", async () => {
            await seedPartStudio(db);
            await seedAssembly(db);
            await fillFavorites(MAX_FAVORITES - 1);

            const app = createTestApp();
            const res = await app.request(
                `${favoritesUrl}?insertableId=${TEST_ASSEMBLY_ID}&id=fav-at-cap`,
                jsonRequest("POST"),
                env
            );

            expect(res.status).toBe(200);
            expect(await countFavorites()).toBe(MAX_FAVORITES);
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
            expect(stamped?.createdAt?.getTime()).toBeGreaterThanOrEqual(
                before
            );
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

        // One id per favorite they could hold, so the cap bounds the batch too.
        it("rejects an order longer than the cap", async () => {
            const app = createTestApp();

            const res = await app.request(
                `/api/favorite-order/library/${TEST_LIBRARY_ID}`,
                jsonRequest("POST", {
                    favoriteOrder: Array.from(
                        { length: MAX_FAVORITES + 1 },
                        (_, i) => `fav-${i}`
                    )
                }),
                env
            );

            expect(res.status).toBe(400);
        });

        it("takes an empty order without reaching for a batch", async () => {
            const app = createTestApp();

            const res = await app.request(
                `/api/favorite-order/library/${TEST_LIBRARY_ID}`,
                jsonRequest("POST", { favoriteOrder: [] }),
                env
            );

            expect(res.status).toBe(200);
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
