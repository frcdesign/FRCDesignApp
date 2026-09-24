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

function reload(accessLevel: AccessLevel, force: boolean) {
    const init = jsonRequest("POST", { force });
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
