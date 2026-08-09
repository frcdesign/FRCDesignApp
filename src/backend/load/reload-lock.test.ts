import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isReloadRunning, markReloadRunning } from "./reload-lock";
import { TEST_LIBRARY_ID } from "../../__test_utils__";

/** Stubs the stored instance id and the instance's live status. */
function mockReloadInstance(instanceId: string | null, status?: string) {
    vi.spyOn(env.KV, "get").mockResolvedValue(instanceId as never);
    vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "get").mockResolvedValue({
        status: () => Promise.resolve({ status })
    } as never);
}

describe("isReloadRunning", () => {
    afterEach(() => vi.restoreAllMocks());

    it("is false when no instance is stored", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue(null as never);
        const getSpy = vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "get");

        expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(false);
        expect(getSpy).not.toHaveBeenCalled();
    });

    it.each(["queued", "running", "waiting", "paused", "waitingForPause"])(
        "is true when the stored instance is %s",
        async (status) => {
            mockReloadInstance("inst-1", status);
            expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(true);
        }
    );

    it.each(["complete", "errored", "terminated", "unknown"])(
        "is false when the stored instance is %s",
        async (status) => {
            mockReloadInstance("inst-1", status);
            expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(false);
        }
    );

    it("is false when the instance aged out of retention", async () => {
        vi.spyOn(env.KV, "get").mockResolvedValue("inst-1" as never);
        vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "get").mockRejectedValue(
            new Error("not found")
        );
        expect(await isReloadRunning(env, TEST_LIBRARY_ID)).toBe(false);
    });
});

describe("markReloadRunning", () => {
    afterEach(() => vi.restoreAllMocks());

    it("stores the instance id under the library's key with a TTL", async () => {
        const putSpy = vi.spyOn(env.KV, "put").mockResolvedValue();

        await markReloadRunning(env, TEST_LIBRARY_ID, "inst-1");

        expect(putSpy).toHaveBeenCalledWith(
            `reload-job:${TEST_LIBRARY_ID}`,
            "inst-1",
            expect.objectContaining({ expirationTtl: expect.any(Number) })
        );
    });
});
