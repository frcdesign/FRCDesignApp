import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    jsonRequest,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { AccessLevel } from "../auth/access-level";
import { LibraryId } from "../library/library-id";
import * as Jobs from "./jobs";
import * as Holds from "./holds";

const db = getDb(env.DB);
const PATH = `/api/reload/library/${LibraryId.FRC_DESIGN_LIB}`;

function reload(accessLevel: AccessLevel, forceReload: boolean) {
    const init = jsonRequest("POST", { forceReload });
    return createTestApp({ accessLevel }).request(
        PATH,
        {
            ...init,
            headers: { ...init.headers, Cookie: "frc-design-app-session=s" }
        },
        env
    );
}

describe("reloading a library", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db, "frc", LibraryId.FRC_DESIGN_LIB);
        await seedGroup(db, "ftc", LibraryId.CONFIG_LIB);
    });
    afterEach(() => vi.restoreAllMocks());

    it("reloads the library's outdated documents for an admin", async () => {
        const load = vi.spyOn(Jobs, "requestReload").mockResolvedValue();

        const res = await reload(AccessLevel.ADMIN, false);

        expect(await res.json()).toEqual({ documents: 1 });
        expect(load.mock.calls[0][1]).toEqual({
            libraryId: LibraryId.FRC_DESIGN_LIB,
            groupIds: ["frc"],
            sessionId: "s",
            forceReload: false
        });
    });

    it("reloads every document for the owner", async () => {
        const load = vi.spyOn(Jobs, "requestReload").mockResolvedValue();

        await reload(AccessLevel.OWNER, true);

        expect(load.mock.calls[0][1]).toMatchObject({
            groupIds: ["frc"],
            forceReload: true
        });
    });

    it("keeps reloading every document to the owner", async () => {
        expect((await reload(AccessLevel.ADMIN, true)).status).toBe(403);
        expect((await reload(AccessLevel.EDITOR, true)).status).toBe(403);
    });

    // Held and failed documents show to editors, so they can act on them.
    it("reloads for an editor", async () => {
        vi.spyOn(Jobs, "requestReload").mockResolvedValue();
        expect((await reload(AccessLevel.EDITOR, false)).status).toBe(200);
    });

    it("turns away somebody who only views", async () => {
        expect((await reload(AccessLevel.USER, false)).status).toBe(403);
    });
});

describe("approving versions", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("approves every held version, as the approver", async () => {
        const approve = vi
            .spyOn(Holds, "approveHeldVersions")
            .mockResolvedValue(2);
        const res = await createTestApp({
            accessLevel: AccessLevel.EDITOR
        }).request(
            `/api/approve-versions/library/${LibraryId.FRC_DESIGN_LIB}`,
            { method: "POST", headers: { Cookie: "frc-design-app-session=s" } },
            env
        );
        expect(await res.json()).toEqual({ documents: 2 });
        expect(approve).toHaveBeenCalledWith(
            expect.anything(),
            LibraryId.FRC_DESIGN_LIB,
            "s"
        );
    });
});

describe("holding new versions", () => {
    const HOLD_PATH = `/api/hold-new-versions/library/${LibraryId.FRC_DESIGN_LIB}`;

    function request(accessLevel: AccessLevel, method: string, body?: unknown) {
        const init = jsonRequest(method, body);
        return createTestApp({ accessLevel }).request(
            HOLD_PATH,
            {
                ...init,
                headers: { ...init.headers, Cookie: "frc-design-app-session=s" }
            },
            env
        );
    }

    beforeEach(() => resetDb(db));

    it("holds by default", async () => {
        const res = await request(AccessLevel.EDITOR, "GET");
        expect(await res.json()).toEqual({ holdNewVersions: true });
    });

    it("is an admin's to turn off", async () => {
        const res = await request(AccessLevel.ADMIN, "POST", {
            holdNewVersions: false
        });
        expect(res.status).toBe(200);
        const read = await request(AccessLevel.EDITOR, "GET");
        expect(await read.json()).toEqual({ holdNewVersions: false });
    });

    it("is not an editor's", async () => {
        const res = await request(AccessLevel.EDITOR, "POST", {
            holdNewVersions: false
        });
        expect(res.status).toBe(403);
    });
});
