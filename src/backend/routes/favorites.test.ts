import { asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { favorites } from "../../shared/schema";
import { LibraryId } from "../../shared/types";
import {
    createTestApp,
    jsonRequest,
    resetDb,
    seedFavorite,
    seedFavoriteFixture,
    seedInsertable
} from "../../__test_utils__";
import { getDb } from "../db";

const LIB = LibraryId.FRC_DESIGN_LIB;
const db = getDb(env.DB);

describe("favorites routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    describe("GET /favorites/library/:libraryId", () => {
        it("returns the user's favorites ordered by sortOrder", async () => {
            const app = createTestApp({ userId: "user-a" });
            const { groupId } = await seedFavoriteFixture(db, {
                userId: "user-a",
                favoriteId: "fav-1",
                sortOrder: 1
            });
            // Second favorite for the same user, lower sortOrder -> comes first.
            const ins2 = await seedInsertable(db, { groupId });
            await seedFavorite(db, {
                id: "fav-0",
                userId: "user-a",
                insertableId: ins2,
                sortOrder: 0
            });

            const res = await app.request(
                `/api/favorites/library/${LIB}`,
                jsonRequest("GET"),
                env
            );
            expect(res.status).toBe(200);
            const body: {
                favoriteOrder: string[];
                favorites: Record<string, unknown>;
            } = await res.json();
            expect(body.favoriteOrder).toEqual(["fav-0", "fav-1"]);
            expect(Object.keys(body.favorites)).toHaveLength(2);
        });

        it("excludes favorites of other users and other libraries", async () => {
            const app = createTestApp({ userId: "user-a" });
            await seedFavoriteFixture(db, { userId: "user-a", favoriteId: "mine" });
            // Another user's favorite.
            await seedFavoriteFixture(db, {
                userId: "user-b",
                favoriteId: "theirs"
            });
            // Same user, different library.
            await seedFavoriteFixture(db, {
                userId: "user-a",
                libraryId: LibraryId.MKCAD,
                favoriteId: "other-lib"
            });

            const res = await app.request(
                `/api/favorites/library/${LIB}`,
                jsonRequest("GET"),
                env
            );
            const body: { favoriteOrder: string[] } = await res.json();
            expect(body.favoriteOrder).toEqual(["mine"]);
        });
    });

    describe("POST /favorites/library/:libraryId", () => {
        it("400s when insertableId is missing", async () => {
            const app = createTestApp({ userId: "user-a" });
            const res = await app.request(
                `/api/favorites/library/${LIB}?id=fav-1`,
                jsonRequest("POST"),
                env
            );
            expect(res.status).toBe(400);
        });

        it("400s when id is missing", async () => {
            const app = createTestApp({ userId: "user-a" });
            const res = await app.request(
                `/api/favorites/library/${LIB}?insertableId=ins-1`,
                jsonRequest("POST"),
                env
            );
            expect(res.status).toBe(400);
        });

        it("creates the user and the favorite with sortOrder = existing count", async () => {
            const app = createTestApp({ userId: "user-a" });
            // Seed one existing favorite plus a second insertable to favorite.
            const { groupId } = await seedFavoriteFixture(db, {
                userId: "user-a",
                insertableId: "ins-1",
                favoriteId: "existing"
            });
            await seedInsertable(db, { id: "ins-2", groupId });

            const res = await app.request(
                `/api/favorites/library/${LIB}?insertableId=ins-2&id=fav-new`,
                jsonRequest("POST"),
                env
            );
            expect(res.status).toBe(200);

            const row = await db
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
            const app = createTestApp({ userId: "user-a" });
            await seedFavoriteFixture(db, {
                userId: "user-a",
                insertableId: "ins-1",
                favoriteId: "dup"
            });

            const res = await app.request(
                `/api/favorites/library/${LIB}?insertableId=ins-1&id=dup`,
                jsonRequest("POST"),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "dup"))
                .all();
            expect(rows).toHaveLength(1);
        });
    });

    describe("DELETE /favorites/:favoriteId", () => {
        it("deletes a favorite owned by the current user", async () => {
            const app = createTestApp({ userId: "user-a" });
            await seedFavoriteFixture(db, {
                userId: "user-a",
                favoriteId: "fav-mine"
            });

            const res = await app.request(
                "/api/favorites/fav-mine",
                jsonRequest("DELETE"),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-mine"))
                .all();
            expect(rows).toHaveLength(0);
        });

        it("does not delete a favorite owned by another user", async () => {
            const app = createTestApp({ userId: "user-a" });
            await seedFavoriteFixture(db, {
                userId: "user-b",
                favoriteId: "fav-theirs"
            });

            const res = await app.request(
                "/api/favorites/fav-theirs",
                jsonRequest("DELETE"),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-theirs"))
                .all();
            expect(rows).toHaveLength(1);
        });
    });

    describe("POST /favorite-order/library/:libraryId", () => {
        it("reorders favorites to match the posted order", async () => {
            const app = createTestApp({ userId: "user-a" });
            const { groupId } = await seedFavoriteFixture(db, {
                userId: "user-a",
                insertableId: "ins-a",
                favoriteId: "fav-a",
                sortOrder: 0
            });
            const insB = await seedInsertable(db, { groupId });
            await seedFavorite(db, {
                id: "fav-b",
                userId: "user-a",
                insertableId: insB,
                sortOrder: 1
            });

            const res = await app.request(
                `/api/favorite-order/library/${LIB}`,
                jsonRequest("POST", { favoriteOrder: ["fav-b", "fav-a"] }),
                env
            );
            expect(res.status).toBe(200);

            const rows = await db
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
            const app = createTestApp({ userId: "user-a" });
            await seedFavoriteFixture(db, {
                userId: "user-a",
                favoriteId: "fav-config"
            });

            const defaultConfiguration = { parameters: [] };
            const res = await app.request(
                "/api/default-configuration/fav-config",
                jsonRequest("POST", { defaultConfiguration }),
                env
            );
            expect(res.status).toBe(200);

            const row = await db
                .select()
                .from(favorites)
                .where(eq(favorites.id, "fav-config"))
                .get();
            expect(row?.defaultConfiguration).toEqual(defaultConfiguration);
        });
    });
});
