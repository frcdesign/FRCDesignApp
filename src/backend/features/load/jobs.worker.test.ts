import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_LIBRARY_ID, resetDb, seedGroup } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { loadJobs } from "../../db/schema";
import * as LibraryDb from "../library/db";
import {
    finishLoad,
    getJobStatus,
    requestLoads,
    type LoadDocumentParams
} from "./jobs";

const db = getDb(env.DB);

function params(groupId: string, forceReload = false): LoadDocumentParams {
    return {
        libraryId: TEST_LIBRARY_ID,
        groupId,
        sessionId: "session",
        forceReload,
        origin: "https://app.example.com"
    };
}

/** Every instance reports `status`, as far as the jobs can tell. */
function instancesAre(status: InstanceStatus["status"]) {
    vi.spyOn(env.LOAD_DOCUMENT_WORKFLOW, "get").mockResolvedValue({
        status: () => Promise.resolve({ status })
    } as never);
}

const job = (groupId: string) =>
    db
        .select()
        .from(loadJobs)
        .all()
        .then((rows) => rows.find((row) => row.groupId === groupId));

describe("document loads", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db, "a");
        await seedGroup(db, "b");
    });
    afterEach(() => vi.restoreAllMocks());

    it("starts a load per group, all in one batch", async () => {
        const create = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "createBatch")
            .mockResolvedValue([]);

        await requestLoads(env, [params("a"), params("b")]);

        expect(create).toHaveBeenCalledOnce();
        const started = create.mock.calls[0][0];
        expect(started.map((start) => start.params?.groupId)).toEqual([
            "a",
            "b"
        ]);
        expect((await job("a"))?.instanceId).toBe(started[0].id);
        instancesAre("running");
        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toMatchObject({
            running: true
        });
    });

    // Two loads writing one group's rows at once would interleave.
    it("queues a load behind the group's running one, keeping it forced", async () => {
        const create = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "createBatch")
            .mockResolvedValue([]);
        await requestLoads(env, [params("a")]);
        instancesAre("running");

        await requestLoads(env, [params("a", true)]);
        await requestLoads(env, [params("a", false)]);

        expect(create).toHaveBeenCalledOnce();
        expect(await job("a")).toMatchObject({ rerun: true, rerunForce: true });
    });

    it("replaces the row of a load that crashed", async () => {
        const create = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "createBatch")
            .mockResolvedValue([]);
        await requestLoads(env, [params("a")]);
        instancesAre("errored");

        await requestLoads(env, [params("a")]);

        expect(create).toHaveBeenCalledTimes(2);
    });

    describe("finishing", () => {
        beforeEach(() => {
            vi.spyOn(
                env.LOAD_DOCUMENT_WORKFLOW,
                "createBatch"
            ).mockResolvedValue([]);
        });

        it("starts the load queued behind it", async () => {
            await requestLoads(env, [params("a")]);
            instancesAre("running");
            await requestLoads(env, [params("a", true)]);
            const create = vi
                .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "create")
                .mockResolvedValue({ id: "next" } as never);

            expect(await finishLoad(env, params("a"))).toBe("rerun");

            expect(create.mock.calls[0][0]?.params).toMatchObject({
                groupId: "a",
                forceReload: true
            });
            expect(await job("a")).toMatchObject({ rerun: false });
        });

        // Once per library rather than once per document.
        it("rebuilds search only as the library's last load finishes", async () => {
            const rebuild = vi
                .spyOn(LibraryDb, "rebuildSearchDb")
                .mockResolvedValue("");
            await requestLoads(env, [params("a"), params("b")]);

            await finishLoad(env, params("a"));
            expect(rebuild).not.toHaveBeenCalled();

            await finishLoad(env, params("b"));
            expect(rebuild).toHaveBeenCalledOnce();
            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                running: false
            });
        });
    });
});
