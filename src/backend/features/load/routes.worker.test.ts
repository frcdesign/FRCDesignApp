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
            headers: { ...init.headers, Cookie: "frc-design-app-cookie=s" }
        },
        env
    );
}

describe("reloading a library", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db, "frc", LibraryId.FRC_DESIGN_LIB);
        await seedGroup(db, "ftc", LibraryId.FTC_DESIGN_LIB);
    });
    afterEach(() => vi.restoreAllMocks());

    it("reloads the library's outdated documents for an admin", async () => {
        const load = vi.spyOn(Jobs, "requestLoads").mockResolvedValue();

        const res = await reload(AccessLevel.ADMIN, false);

        expect(await res.json()).toEqual({ documents: 1 });
        expect(load.mock.calls[0][1]).toEqual([
            expect.objectContaining({
                groupId: "frc",
                sessionId: "s",
                forceReload: false
            })
        ]);
    });

    it("reloads every document for the owner", async () => {
        const load = vi.spyOn(Jobs, "requestLoads").mockResolvedValue();

        await reload(AccessLevel.OWNER, true);

        expect(load.mock.calls[0][1]).toEqual([
            expect.objectContaining({ groupId: "frc", forceReload: true })
        ]);
    });

    it("keeps reloading every document to the owner", async () => {
        expect((await reload(AccessLevel.ADMIN, true)).status).toBe(403);
    });

    it("turns away an editor", async () => {
        expect((await reload(AccessLevel.EDITOR, false)).status).toBe(403);
    });
});

describe("approving versions", () => {
    const APPROVAL_PATH = `/api/version-approval/library/${LibraryId.FRC_DESIGN_LIB}`;

    function call(method: "GET" | "POST", path: string, body?: object) {
        const init = body ? jsonRequest(method, body) : { method };
        return createTestApp({ accessLevel: AccessLevel.ADMIN }).request(
            path,
            {
                ...init,
                headers: {
                    ...("headers" in init ? init.headers : {}),
                    Cookie: "frc-design-app-cookie=s"
                }
            },
            env
        );
    }

    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db, "frc", LibraryId.FRC_DESIGN_LIB);
    });
    afterEach(() => vi.restoreAllMocks());

    it("is off until an admin turns it on", async () => {
        expect(await (await call("GET", APPROVAL_PATH)).json()).toEqual({
            enabled: false
        });
        await call("POST", APPROVAL_PATH, { enabled: true });
        expect(await (await call("GET", APPROVAL_PATH)).json()).toEqual({
            enabled: true
        });
    });

    it("lets held versions through when turned off", async () => {
        const approve = vi.spyOn(Jobs, "approveHeldLoads").mockResolvedValue(2);
        await call("POST", APPROVAL_PATH, { enabled: false });
        expect(approve).toHaveBeenCalledWith(
            expect.anything(),
            LibraryId.FRC_DESIGN_LIB
        );
    });

    it("approves every held version", async () => {
        vi.spyOn(Jobs, "approveHeldLoads").mockResolvedValue(2);
        const res = await call(
            "POST",
            `/api/approve-versions/library/${LibraryId.FRC_DESIGN_LIB}`
        );
        expect(await res.json()).toEqual({ documents: 2 });
    });
});
