import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { TEST_LIBRARY_ID, resetDb, seedGroup } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { groups, libraries } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import * as Jobs from "./jobs";
import { approveHeldVersions, receiveNewVersion, releaseHold } from "./holds";

const db = getDb(env.DB);

const heldAtOf = async (groupId: string) =>
    (
        await db
            .select({ heldAt: groups.heldAt })
            .from(groups)
            .where(eq(groups.id, groupId))
            .get()
    )?.heldAt;

const cacheVersionOf = async (libraryId: LibraryId) =>
    (
        await db
            .select({ cacheVersion: libraries.cacheVersion })
            .from(libraries)
            .where(eq(libraries.id, libraryId))
            .get()
    )?.cacheVersion;

describe("held versions", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("holds the document's group in every library, bumping each", async () => {
        await seedGroup(db, "a", LibraryId.FRC_DESIGN_LIB, {
            documentId: "doc"
        });
        await seedGroup(db, "b", LibraryId.CONFIG_LIB, { documentId: "doc" });
        await seedGroup(db, "c");
        const startVersion = await cacheVersionOf(LibraryId.FRC_DESIGN_LIB);

        await receiveNewVersion(env, "doc");

        expect(await heldAtOf("a")).toEqual(expect.any(Date));
        expect(await heldAtOf("b")).toEqual(expect.any(Date));
        expect(await heldAtOf("c")).toBeNull();
        expect(await cacheVersionOf(LibraryId.FRC_DESIGN_LIB)).toBeGreaterThan(
            startVersion ?? 0
        );
    });

    it("loads the new version at once where the library doesn't hold them", async () => {
        await seedGroup(db, "a", LibraryId.FRC_DESIGN_LIB, {
            documentId: "doc"
        });
        await seedGroup(db, "b", LibraryId.CONFIG_LIB, { documentId: "doc" });
        await db
            .update(libraries)
            .set({ holdNewVersions: false })
            .where(eq(libraries.id, LibraryId.CONFIG_LIB));
        const load = vi.spyOn(Jobs, "requestReload").mockResolvedValue();

        await receiveNewVersion(env, "doc");

        expect(await heldAtOf("a")).toEqual(expect.any(Date));
        expect(await heldAtOf("b")).toBeNull();
        expect(load).toHaveBeenCalledOnce();
        expect(load).toHaveBeenCalledWith(expect.anything(), {
            libraryId: LibraryId.CONFIG_LIB,
            groupIds: ["b"],
            forceReload: false
        });
    });

    it("releases only a hold set before the version was read", async () => {
        const readAt = Date.now();
        await seedGroup(db, "early", TEST_LIBRARY_ID, {
            heldAt: new Date(readAt - 1)
        });
        await seedGroup(db, "late", TEST_LIBRARY_ID, {
            heldAt: new Date(readAt + 1)
        });

        await releaseHold(db, "early", readAt);
        await releaseHold(db, "late", readAt);

        expect(await heldAtOf("early")).toBeNull();
        expect(await heldAtOf("late")).toEqual(new Date(readAt + 1));
    });

    it("reloads the held groups as the approver", async () => {
        await seedGroup(db, "held", TEST_LIBRARY_ID, { heldAt: new Date() });
        await seedGroup(db, "current");
        const load = vi.spyOn(Jobs, "requestReload").mockResolvedValue();

        expect(await approveHeldVersions(env, TEST_LIBRARY_ID, "s")).toBe(1);

        expect(load).toHaveBeenCalledWith(expect.anything(), {
            libraryId: TEST_LIBRARY_ID,
            groupIds: ["held"],
            sessionId: "s",
            forceReload: false
        });
    });
});
