import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import { Theme } from "../settings/settings";
import {
    TEST_GROUP_ID,
    TEST_USER_ID,
    createTestApp,
    jsonRequest,
    TEST_LIBRARY_ID,
    resetDb,
    seedGroup,
    seedUser
} from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);

describe("GET /init", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("sends a user to the library they last used", async () => {
        await seedUser(db);
        await db
            .update(users)
            .set({ libraryId: LibraryId.MKCAD })
            .where(eq(users.id, TEST_USER_ID));

        const res = await createTestApp().request(
            "/init?documentId=doc&workspaceId=ws",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(302);
        const location = new URL(res.headers.get("Location")!, "http://x");
        expect(location.pathname).toBe(`/app/library/${LibraryId.MKCAD}`);
        // The Onshape params have to survive the redirect.
        expect(location.searchParams.get("documentId")).toBe("doc");
        expect(location.searchParams.get("workspaceId")).toBe("ws");
    });

    it("sends a user with no row to the default library", async () => {
        const res = await createTestApp().request(
            "/init",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toContain(
            `/app/library/${LibraryId.FRC_DESIGN_LIB}`
        );
    });

    it("seeds the saved theme and forwards Onshape's color scheme", async () => {
        await seedUser(db);
        await db
            .update(users)
            .set({ theme: Theme.DARK })
            .where(eq(users.id, TEST_USER_ID));

        const res = await createTestApp().request(
            "/init?theme=light",
            jsonRequest("GET"),
            env
        );

        const location = new URL(res.headers.get("Location")!, "http://x");
        // Onshape's scheme becomes systemTheme; theme carries the user's choice.
        expect(location.searchParams.get("systemTheme")).toBe("light");
        expect(location.searchParams.get("theme")).toBe(Theme.DARK);
    });

    it("seeds the default theme for a user with no row", async () => {
        const res = await createTestApp().request(
            "/init",
            jsonRequest("GET"),
            env
        );

        const location = new URL(res.headers.get("Location")!, "http://x");
        expect(location.searchParams.get("theme")).toBe(Theme.SYSTEM);
    });

    /** The library and group a user left off in, as their row records them. */
    async function seedResume(libraryId: LibraryId, groupId: string | null) {
        await seedUser(db);
        await db
            .update(users)
            .set({ libraryId, groupId })
            .where(eq(users.id, TEST_USER_ID));
    }

    async function entryPath(): Promise<string> {
        const res = await createTestApp().request(
            "/init",
            jsonRequest("GET"),
            env
        );
        return new URL(res.headers.get("Location")!, "http://x").pathname;
    }

    it("resumes in the group they last opened", async () => {
        await seedGroup(db);
        await seedResume(TEST_LIBRARY_ID, TEST_GROUP_ID);

        expect(await entryPath()).toBe(
            `/app/library/${TEST_LIBRARY_ID}/groups/${TEST_GROUP_ID}`
        );
    });

    // The group is gone, so the caller lands in the library rather than on a
    // "group not found" page.
    it("falls back to the library when the group has been deleted", async () => {
        await seedResume(TEST_LIBRARY_ID, "deleted-group");

        expect(await entryPath()).toBe(`/app/library/${TEST_LIBRARY_ID}`);
    });

    // Whichever library they switched to, they have not opened a group in it.
    it("ignores a group belonging to another library", async () => {
        await seedGroup(db);
        await seedResume(LibraryId.MKCAD, TEST_GROUP_ID);

        expect(await entryPath()).toBe(`/app/library/${LibraryId.MKCAD}`);
    });

    it("never caches the gate's verdict", async () => {
        const res = await createTestApp().request(
            "/init",
            jsonRequest("GET"),
            env
        );
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });
});
