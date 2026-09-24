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

function reload(path: string, accessLevel: AccessLevel, force: boolean) {
    const init = jsonRequest("POST", { force });
    return createTestApp({ accessLevel }).request(
        path,
        {
            ...init,
            headers: { ...init.headers, Cookie: "frc-design-app-cookie=s" }
        },
        env
    );
}

const requested = (load: ReturnType<typeof vi.spyOn>) =>
    (load.mock.calls[0]?.[1] as Jobs.LoadDocumentParams[]).map((request) => [
        request.groupId,
        request.forceReload
    ]);

describe("reloading", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db, "frc", LibraryId.FRC_DESIGN_LIB);
        await seedGroup(db, "ftc", LibraryId.FTC_DESIGN_LIB);
    });
    afterEach(() => vi.restoreAllMocks());

    const LIBRARY_PATH = `/api/reload/library/${LibraryId.FRC_DESIGN_LIB}`;

    it.each([false, true])(
        "reloads one library's documents for its admin (force=%s)",
        async (force) => {
            const load = vi.spyOn(Jobs, "requestLoads").mockResolvedValue();

            const res = await reload(LIBRARY_PATH, AccessLevel.ADMIN, force);

            expect(await res.json()).toEqual({ documents: 1 });
            expect(requested(load)).toEqual([["frc", force]]);
        }
    );

    it("turns away an editor", async () => {
        const res = await reload(LIBRARY_PATH, AccessLevel.EDITOR, false);
        expect(res.status).toBe(403);
    });

    it("reloads every library for the owner", async () => {
        const load = vi.spyOn(Jobs, "requestLoads").mockResolvedValue();

        await reload("/api/reload-all", AccessLevel.OWNER, false);

        expect(requested(load).sort()).toEqual([
            ["frc", false],
            ["ftc", false]
        ]);
    });

    it("keeps reloading every library to the owner", async () => {
        const res = await reload("/api/reload-all", AccessLevel.ADMIN, true);
        expect(res.status).toBe(403);
    });
});
