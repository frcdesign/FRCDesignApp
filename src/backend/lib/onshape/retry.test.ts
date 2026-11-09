import { afterEach, describe, expect, it, vi } from "vitest";
import {
    OnshapeApiError,
    OnshapeRateLimitError,
    OnshapeTimeoutError
} from "./client";
import { retryInsert } from "./retry";

const NO_WAIT = { retries: 1, delayMs: 0, timeoutMs: 20_000 };

describe("retryInsert", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        ["a 5xx", new OnshapeApiError("boom", 500)],
        ["a timeout", new OnshapeTimeoutError(20_000)]
    ])("calls again after %s", async (_label, error) => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce("inserted");

        await expect(retryInsert(call, NO_WAIT)).resolves.toBe("inserted");
        expect(call).toHaveBeenCalledTimes(2);
    });

    it("gives each attempt the policy's timeout", async () => {
        const call = vi.fn().mockResolvedValue("inserted");

        await retryInsert(call, NO_WAIT);

        expect(call).toHaveBeenCalledWith(20_000);
    });

    it("gives up once its retries are spent", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValue(new OnshapeApiError("boom", 503));

        await expect(retryInsert(call, NO_WAIT)).rejects.toMatchObject({
            status: 503
        });
        expect(call).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["a 4xx", new OnshapeApiError("bad configuration", 400)],
        ["a rate limit", new OnshapeRateLimitError("slow down", 60)],
        ["our own failure", new TypeError("undefined is not a function")]
    ])("does not retry %s", async (_label, error) => {
        const call = vi.fn().mockRejectedValue(error);

        await expect(retryInsert(call, NO_WAIT)).rejects.toBe(error);
        expect(call).toHaveBeenCalledTimes(1);
    });
});
