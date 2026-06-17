import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { favorites } from "../../shared/schema";
import { LibraryId } from "../../shared/types";
import {
    clearAll,
    createTestHarness,
    seedFavorite,
    seedFavoriteFixture,
    seedInsertable,
    seedLibrary
} from "../../__test_utils__";
import { getDb } from "../db";
import { favoriteRoutes } from "./favorites";

const LIB = LibraryId.FRC_DESIGN_LIB;

function harness(userId = "user-a") {
    return createTestHarness({ routes: favoriteRoutes, userId });
}

describe("favorites routes", () => {
    beforeEach(async () => {
        await clearAll(getDb(env.DB));
    });

    describe("GET /favorites/library/:libraryId", () => {
        it("returns the user's favorites ordered by sortOrder", async () => {
            const h = harness("user-a");
            await seedLibrary(h.db, LIB);
            const ins1 = await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                favoriteId: "fav-1",
                sortOrder: 1
            });
            // Second favorite for the same user, lower sortOrder -> should come first.
            const ins2 = await seedInsertable(h.db, {
                groupId: ins1.groupId,
                libraryId: LIB,
                elementId: "el-2"
            });
            await seedFavorite(h.db, {
                favoriteId: "fav-0",
                userId: "user-a",
                libraryId: LIB,
                insertableId: ins2,
                sortOrder: 0
            });

            const res = await h.request("GET", `/api/favorites/library/${LIB}`);
            expect(res.status).toBe(200);
            const body: {
                favoriteOrder: string[];
                favorites: Record<string, unknown>;
            } = await res.json();
            expect(body.favoriteOrder).toEqual(["fav-0", "fav-1"]);
            expect(Object.keys(body.favorites)).toHaveLength(2);
        });

        it("excludes favorites of other users and other libraries", async () => {
            const h = harness("user-a");
            await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                favoriteId: "mine"
            });
            // Another user's favorite.
            await seedFavoriteFixture(h.db, {
                userId: "user-b",
                libraryId: LIB,
                favoriteId: "theirs"
            });
            // Same user, different library.
            await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LibraryId.MKCAD,
                favoriteId: "other-lib"
            });

            const res = await h.request("GET", `/api/favorites/library/${LIB}`);
            const body: { favoriteOrder: string[] } = await res.json();
            expect(body.favoriteOrder).toEqual(["mine"]);
        });
    });

    describe("POST /favorites/library/:libraryId", () => {
        it("400s when insertableId is missing", async () => {
            const h = harness("user-a");
            const res = await h.request("POST", `/api/favorites/library/${LIB}`, {
                query: { id: "fav-1" }
            });
            expect(res.status).toBe(400);
        });

        it("400s when id is missing", async () => {
            const h = harness("user-a");
            const res = await h.request("POST", `/api/favorites/library/${LIB}`, {
                query: { insertableId: "ins-1" }
            });
            expect(res.status).toBe(400);
        });

        it("creates the user and the favorite with sortOrder = existing count", async () => {
            const h = harness("user-a");
            // Seed parents (library + insertables) without creating a favorite.
            await seedLibrary(h.db, LIB);
            const { groupId } = await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                insertableId: "ins-1",
                favoriteId: "existing"
            });
            await seedInsertable(h.db, {
                id: "ins-2",
                groupId,
                libraryId: LIB,
                elementId: "el-ins-2"
            });

            const res = await h.request("POST", `/api/favorites/library/${LIB}`, {
                query: { insertableId: "ins-2", id: "fav-new" }
            });
            expect(res.status).toBe(200);

            const row = await h.db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-new"))
                .get();
            expect(row).toBeDefined();
            expect(row?.userId).toBe("user-a");
            expect(row?.insertableId).toBe("ins-2");
            // One favorite ("existing") already present, so sortOrder is 1.
            expect(row?.sortOrder).toBe(1);
        });

        it("is idempotent on conflicting id", async () => {
            const h = harness("user-a");
            await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                insertableId: "ins-1",
                favoriteId: "dup"
            });

            const res = await h.request("POST", `/api/favorites/library/${LIB}`, {
                query: { insertableId: "ins-1", id: "dup" }
            });
            expect(res.status).toBe(200);

            const rows = await h.db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "dup"))
                .all();
            expect(rows).toHaveLength(1);
        });
    });

    describe("DELETE /favorites/:favoriteId", () => {
        it("deletes a favorite owned by the current user", async () => {
            const h = harness("user-a");
            await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                favoriteId: "fav-mine"
            });

            const res = await h.request("DELETE", "/api/favorites/fav-mine");
            expect(res.status).toBe(200);

            const rows = await h.db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-mine"))
                .all();
            expect(rows).toHaveLength(0);
        });

        it("does not delete a favorite owned by another user", async () => {
            const h = harness("user-a");
            await seedFavoriteFixture(h.db, {
                userId: "user-b",
                libraryId: LIB,
                favoriteId: "fav-theirs"
            });

            const res = await h.request("DELETE", "/api/favorites/fav-theirs");
            expect(res.status).toBe(200);

            const rows = await h.db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-theirs"))
                .all();
            expect(rows).toHaveLength(1);
        });
    });

    describe("POST /favorite-order/library/:libraryId", () => {
        it("reorders favorites to match the posted order", async () => {
            const h = harness("user-a");
            const { groupId } = await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                insertableId: "ins-a",
                favoriteId: "fav-a",
                sortOrder: 0
            });
            const insB = await seedInsertable(h.db, {
                groupId,
                libraryId: LIB,
                elementId: "el-b"
            });
            await seedFavorite(h.db, {
                favoriteId: "fav-b",
                userId: "user-a",
                libraryId: LIB,
                insertableId: insB,
                sortOrder: 1
            });

            const res = await h.request(
                "POST",
                `/api/favorite-order/library/${LIB}`,
                { body: { favoriteOrder: ["fav-b", "fav-a"] } }
            );
            expect(res.status).toBe(200);

            const rows = await h.db
                .select()
                .from(favorites)
                .where(eq(favorites.userId, "user-a"))
                .orderBy(asc(favorites.sortOrder))
                .all();
            expect(rows.map((r) => r.id)).toEqual(["fav-b", "fav-a"]);
        });
    });

    describe("POST /default-configuration/:favoriteId", () => {
        it("persists the default configuration", async () => {
            const h = harness("user-a");
            await seedFavoriteFixture(h.db, {
                userId: "user-a",
                libraryId: LIB,
                favoriteId: "fav-config"
            });

            const defaultConfiguration = { parameters: [] };
            const res = await h.request(
                "POST",
                "/api/default-configuration/fav-config",
                { body: { defaultConfiguration } }
            );
            expect(res.status).toBe(200);

            const row = await h.db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-config"))
                .get();
            expect(row?.defaultConfiguration).toEqual(defaultConfiguration);
        });
    });
});
