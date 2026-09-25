import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_LIBRARY_ID, resetDb, seedGroup } from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { groups, loadJobs } from "../../db/schema";
import { eq } from "drizzle-orm";
import { BuildIssueType } from "../build-checker/issues";
import * as LibraryDb from "../library/db";
import {
    APPROVE_EVENT,
    approveHeldLoads,
    finishLoad,
    getJobStatus,
    setAwaitingApproval,
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

/** Every instance reports `status`, as far as the jobs can tell. Returns their controls. */
function instancesAre(status: InstanceStatus["status"]) {
    const instance = {
        status: () => Promise.resolve({ status }),
        sendEvent: vi.fn().mockResolvedValue(undefined),
        terminate: vi.fn().mockResolvedValue(undefined)
    };
    vi.spyOn(env.LOAD_DOCUMENT_WORKFLOW, "get").mockResolvedValue(
        instance as never
    );
    return instance;
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
        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
            loadingGroupIds: ["a", "b"],
            awaitingApprovalGroupIds: []
        });
    });

    // Two loads writing one group's rows at once would interleave.
    it("replaces the group's running load, which it stops", async () => {
        const create = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "createBatch")
            .mockResolvedValue([]);
        await requestLoads(env, [params("a")]);
        const { terminate } = instancesAre("running");

        await requestLoads(env, [params("a")]);

        expect(terminate).toHaveBeenCalledOnce();
        const replacement = create.mock.calls[1][0][0];
        expect((await job("a"))?.instanceId).toBe(replacement.id);
    });

    it("keeps a replaced load's force", async () => {
        const create = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "createBatch")
            .mockResolvedValue([]);
        await requestLoads(env, [params("a", true)]);
        instancesAre("running");

        await requestLoads(env, [params("a", false)]);

        expect(create.mock.calls[1][0][0].params).toMatchObject({
            forceReload: true
        });
        expect(await job("a")).toMatchObject({ forceReload: true });
    });

    it("replaces the row of a load that crashed, and flags its group", async () => {
        const create = vi
            .spyOn(env.LOAD_DOCUMENT_WORKFLOW, "createBatch")
            .mockResolvedValue([]);
        await requestLoads(env, [params("a")]);
        instancesAre("errored");

        await requestLoads(env, [params("a")]);

        expect(create).toHaveBeenCalledTimes(2);
        const group = await db
            .select({ buildIssues: groups.buildIssues })
            .from(groups)
            .where(eq(groups.id, "a"))
            .get();
        expect(group?.buildIssues).toContainEqual({
            type: BuildIssueType.LOAD_FAILED
        });
    });

    describe("approval", () => {
        const held = { ...params("a"), awaitApproval: true };

        beforeEach(async () => {
            vi.spyOn(
                env.LOAD_DOCUMENT_WORKFLOW,
                "createBatch"
            ).mockResolvedValue([]);
            await requestLoads(env, [held]);
            await setAwaitingApproval(env, held, true);
        });

        it("reports a held load apart from the running ones", async () => {
            instancesAre("waiting");
            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: [],
                awaitingApprovalGroupIds: ["a"]
            });
        });

        it("lets every held load through", async () => {
            const { sendEvent } = instancesAre("waiting");

            expect(await approveHeldLoads(env, TEST_LIBRARY_ID)).toBe(1);

            expect(sendEvent).toHaveBeenCalledWith({
                type: APPROVE_EVENT,
                payload: {}
            });
            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: ["a"],
                awaitingApprovalGroupIds: []
            });
        });

        it("replaces a held load with one someone asked for outright", async () => {
            instancesAre("waiting");
            await requestLoads(env, [params("a")]);
            expect(await job("a")).toMatchObject({ awaitingApproval: false });
        });
    });

    describe("finishing", () => {
        beforeEach(() => {
            vi.spyOn(
                env.LOAD_DOCUMENT_WORKFLOW,
                "createBatch"
            ).mockResolvedValue([]);
        });

        it("leaves the group to the load that replaced it", async () => {
            await requestLoads(env, [params("a")]);
            const replaced = (await job("a"))?.instanceId ?? "";
            instancesAre("running");
            await requestLoads(env, [params("a")]);

            await finishLoad(env, params("a"), replaced, false);

            expect((await job("a"))?.instanceId).not.toBe(replaced);
        });

        // Each load publishes what it wrote, standing alone.
        it("rebuilds search for a load that changed its group", async () => {
            const rebuild = vi
                .spyOn(LibraryDb, "rebuildSearchDb")
                .mockResolvedValue("");
            await requestLoads(env, [params("a"), params("b")]);
            const instanceOf = async (groupId: string) =>
                (await job(groupId))?.instanceId ?? "";

            await finishLoad(env, params("a"), await instanceOf("a"), true);
            expect(rebuild).toHaveBeenCalledOnce();

            await finishLoad(env, params("b"), await instanceOf("b"), false);
            expect(rebuild).toHaveBeenCalledOnce();
            expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
                loadingGroupIds: [],
                awaitingApprovalGroupIds: []
            });
        });
    });
});
