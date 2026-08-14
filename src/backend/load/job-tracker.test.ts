import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    getJobStatus,
    isReloadRunning,
    trackJob,
    untrackJob
} from "./job-tracker";
import { TEST_LIBRARY_ID } from "../../__test_utils__";

interface Job {
    id: string;
    kind: "reload" | "add-group";
    startedAt?: number;
}

/** Stubs the stored jobs array and every instance's live status. */
function mockJobs(jobs: Job[], status?: string) {
    vi.spyOn(env.KV, "get").mockResolvedValue(JSON.stringify(jobs) as never);
    const instance = { status: () => Promise.resolve({ status }) } as never;
    vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "get").mockResolvedValue(instance);
    vi.spyOn(env.ADD_GROUP_WORKFLOW, "get").mockResolvedValue(instance);
}

describe("job-tracker", () => {
    afterEach(() => vi.restoreAllMocks());

    it("reports nothing running when no jobs are stored", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue(null as never);
        expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(false);
        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
            running: false
        });
    });

    it.each(["queued", "running", "waiting", "paused", "waitingForPause"])(
        "counts a %s reload as running",
        async (status) => {
            mockJobs([{ id: "r1", kind: "reload" }], status);
            expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(true);
            expect((await getJobStatus(env, TEST_LIBRARY_ID)).running).toBe(
                true
            );
        }
    );

    it.each(["complete", "errored", "terminated", "unknown"])(
        "counts a %s reload as finished",
        async (status) => {
            mockJobs([{ id: "r1", kind: "reload" }], status);
            expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(false);
            expect((await getJobStatus(env, TEST_LIBRARY_ID)).running).toBe(
                false
            );
        }
    );

    it("a running add-group counts as any-job but not as a reload", async () => {
        mockJobs([{ id: "a1", kind: "add-group" }], "running");
        expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(false);
        expect((await getJobStatus(env, TEST_LIBRARY_ID)).running).toBe(true);
    });

    it("treats an aged-out instance as finished", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue(
            JSON.stringify([{ id: "r1", kind: "reload" }]) as never
        );
        vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "get").mockRejectedValue(
            new Error("not found")
        );
        expect((await getJobStatus(env, TEST_LIBRARY_ID)).running).toBe(false);
    });

    it("reports how long the oldest running job has been going", async () => {
        const now = Date.now();
        mockJobs(
            [
                { id: "r1", kind: "reload", startedAt: now - 30_000 },
                { id: "a1", kind: "add-group", startedAt: now - 5_000 }
            ],
            "running"
        );

        const status = await getJobStatus(env, TEST_LIBRARY_ID);
        expect(status.running).toBe(true);
        expect(status.runningForMs).toBeGreaterThanOrEqual(30_000);
        expect(status.runningForMs).toBeLessThan(40_000);
    });

    it("reports no age when a job predates start-time tracking", async () => {
        mockJobs([{ id: "r1", kind: "reload" }], "running");
        expect(await getJobStatus(env, TEST_LIBRARY_ID)).toEqual({
            running: true
        });
    });

    it("appends a tracked job under the library key with a TTL", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue(null as never);
        const putSpy = vi.spyOn(env.KV, "put").mockResolvedValue();

        await trackJob(env, TEST_LIBRARY_ID, "reload", "r1");

        const [key, value, options] = putSpy.mock.calls[0];
        expect(key).toBe(`library-jobs:${TEST_LIBRARY_ID}`);
        expect(JSON.parse(value as string)).toEqual([
            { id: "r1", kind: "reload", startedAt: expect.any(Number) }
        ]);
        expect(options).toEqual(
            expect.objectContaining({ expirationTtl: expect.any(Number) })
        );
    });

    it("untrackJob removes only its own entry, keeping others", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue(
            JSON.stringify([
                { id: "r1", kind: "reload" },
                { id: "a1", kind: "add-group" }
            ]) as never
        );
        const putSpy = vi.spyOn(env.KV, "put").mockResolvedValue();

        await untrackJob(env, TEST_LIBRARY_ID, "r1");

        expect(putSpy).toHaveBeenCalledWith(
            `library-jobs:${TEST_LIBRARY_ID}`,
            JSON.stringify([{ id: "a1", kind: "add-group" }]),
            expect.objectContaining({ expirationTtl: expect.any(Number) })
        );
    });

    it("untrackJob deletes the key once the last job finishes", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue(
            JSON.stringify([{ id: "r1", kind: "reload" }]) as never
        );
        const deleteSpy = vi.spyOn(env.KV, "delete").mockResolvedValue();

        await untrackJob(env, TEST_LIBRARY_ID, "r1");

        expect(deleteSpy).toHaveBeenCalledWith(
            `library-jobs:${TEST_LIBRARY_ID}`
        );
    });
});
