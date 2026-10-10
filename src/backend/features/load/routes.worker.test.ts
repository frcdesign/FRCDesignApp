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
        vi.spyOn(Jobs, "approveHeldReloads").mockResolvedValue(0);

        const res = await reload(AccessLevel.ADMIN, false);

        expect(await res.json()).toEqual({ documents: 1 });
        expect(load.mock.calls[0][1]).toEqual({
            libraryId: LibraryId.FRC_DESIGN_LIB,
            groupIds: ["frc"],
            sessionId: "s",
            forceReload: false,
            held: false
        });
    });

    it("reloads every document for the owner", async () => {
        const load = vi.spyOn(Jobs, "requestReload").mockResolvedValue();
        vi.spyOn(Jobs, "approveHeldReloads").mockResolvedValue(0);

        await reload(AccessLevel.OWNER, true);

        expect(load.mock.calls[0][1]).toMatchObject({
            groupIds: ["frc"],
            forceReload: true
        });
    });

    // It loads whatever is new, so a held version has nothing left to wait for.
    it("lets the held versions through", async () => {
        vi.spyOn(Jobs, "requestReload").mockResolvedValue();
        const approve = vi
            .spyOn(Jobs, "approveHeldReloads")
            .mockResolvedValue(1);

        await reload(AccessLevel.ADMIN, false);

        expect(approve).toHaveBeenCalledWith(
            expect.anything(),
            LibraryId.FRC_DESIGN_LIB
        );
    });

    it("keeps reloading every document to the owner", async () => {
        expect((await reload(AccessLevel.ADMIN, true)).status).toBe(403);
    });

    it("turns away an editor", async () => {
        expect((await reload(AccessLevel.EDITOR, false)).status).toBe(403);
    });
});

describe("approving versions", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("approves every held version", async () => {
        vi.spyOn(Jobs, "approveHeldReloads").mockResolvedValue(2);
        const res = await createTestApp({
            accessLevel: AccessLevel.ADMIN
        }).request(
            `/api/approve-versions/library/${LibraryId.FRC_DESIGN_LIB}`,
            { method: "POST", headers: { Cookie: "frc-design-app-session=s" } },
            env
        );
        expect(await res.json()).toEqual({ documents: 2 });
    });
});
