import { env } from "cloudflare:workers";
import { env as processEnv } from "process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccessLevel } from "./access-level";
import { productionAuth } from "./request-auth";
import { createApp } from "../../app";
import { jsonRequest, resetDb, seedLibrary } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { adminTeamMembers } from "../../db/schema";
import { LibraryId } from "../library/library-id";
import { saveSession } from "./session";

const app = createApp(productionAuth);

/** What the real caller resolves for a request carrying no Onshape session. */
async function getMaxAccessLevel(override?: AccessLevel): Promise<AccessLevel> {
    const res = await app.request(
        "/api/access-data/library/frc-design-lib",
        jsonRequest("GET"),
        {
            ...env,
            VITE_ACCESS_LEVEL_OVERRIDE: override
        }
    );
    const body: { maxAccessLevel: AccessLevel } = await res.json();
    return body.maxAccessLevel;
}

describe("the dev access-level override", () => {
    const nodeEnv = processEnv.NODE_ENV;
    afterEach(() => {
        processEnv.NODE_ENV = nodeEnv;
    });

    it("grants the level it names", async () => {
        expect(await getMaxAccessLevel(AccessLevel.ADMIN)).toBe(
            AccessLevel.ADMIN
        );
    });

    it("is ignored in production", async () => {
        processEnv.NODE_ENV = "production";
        expect(await getMaxAccessLevel(AccessLevel.ADMIN)).toBe(
            AccessLevel.USER
        );
    });

    it("leaves an unset override to the caller's own session", async () => {
        expect(await getMaxAccessLevel()).toBe(AccessLevel.USER);
    });
});

describe("access from a library's admin team", () => {
    const OWNER = "owner-user-id";

    beforeEach(async () => {
        const db = getDb(env.DB);
        await resetDb(db);
        await seedLibrary(db, LibraryId.FRC_DESIGN_LIB);
        await seedLibrary(db, LibraryId.FTC_DESIGN_LIB);
        await db.insert(adminTeamMembers).values([
            {
                libraryId: LibraryId.FRC_DESIGN_LIB,
                userId: "member",
                isTeamAdmin: false
            },
            {
                libraryId: LibraryId.FRC_DESIGN_LIB,
                userId: "team-admin",
                isTeamAdmin: true
            }
        ]);
    });

    /** A signed-in session whose user is already resolved, so Onshape is not asked. */
    async function accessLevelOf(
        userId: string,
        libraryId: LibraryId = LibraryId.FRC_DESIGN_LIB
    ): Promise<AccessLevel> {
        const sessionId = crypto.randomUUID();
        await saveSession(env.KV, sessionId, {
            accessToken: "token",
            refreshToken: "refresh",
            expiresAt: Date.now() + 60_000,
            userId
        });
        const res = await app.request(
            `/api/access-data/library/${libraryId}`,
            {
                method: "GET",
                headers: { Cookie: `frc-design-app-cookie=${sessionId}` }
            },
            { ...env, OWNER_USER_ID: OWNER }
        );
        const body: { maxAccessLevel: AccessLevel } = await res.json();
        return body.maxAccessLevel;
    }

    it("is the user OWNER_USER_ID names", async () => {
        expect(await accessLevelOf(OWNER)).toBe(AccessLevel.OWNER);
    });

    // So a load nobody is signed in behind can run as them.
    it("keeps an admin's session, and nobody else's", async () => {
        await accessLevelOf("team-admin");
        await accessLevelOf("member");
        expect(await env.KV.get("admin-session:team-admin")).toBeTruthy();
        expect(await env.KV.get("admin-session:member")).toBeNull();
    });

    it("makes a member an editor, and a team admin an admin", async () => {
        expect(await accessLevelOf("member")).toBe(AccessLevel.EDITOR);
        expect(await accessLevelOf("team-admin")).toBe(AccessLevel.ADMIN);
        expect(await accessLevelOf("stranger")).toBe(AccessLevel.USER);
    });

    // Access is per library now: one library's team edits that library alone.
    it("grants nothing in a library whose team the user is not on", async () => {
        expect(
            await accessLevelOf("team-admin", LibraryId.FTC_DESIGN_LIB)
        ).toBe(AccessLevel.USER);
    });

    it("gives the owner every library", async () => {
        expect(await accessLevelOf(OWNER, LibraryId.FTC_DESIGN_LIB)).toBe(
            AccessLevel.OWNER
        );
    });
});
