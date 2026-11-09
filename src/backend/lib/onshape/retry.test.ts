import { afterEach, describe, expect, it, vi } from "vitest";
import {
    OnshapeApiError,
    OnshapeRateLimitError,
    OnshapeTimeoutError
} from "./client";
import { retryOnServerError } from "./retry";

const NO_WAIT = { retries: 1, delayMs: 0 };

describe("retryOnServerError", () => {
    afterEach(() => vi.restoreAllMocks());

    it("calls again when Onshape answers 5xx", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValueOnce(new OnshapeApiError("boom", 500))
            .mockResolvedValueOnce("inserted");

        await expect(retryOnServerError(call, NO_WAIT)).resolves.toBe(
            "inserted"
        );
        expect(call).toHaveBeenCalledTimes(2);
    });

    it("gives up once its retries are spent", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValue(new OnshapeApiError("boom", 503));

        await expect(retryOnServerError(call, NO_WAIT)).rejects.toMatchObject({
            status: 503
        });
        expect(call).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["a 4xx", new OnshapeApiError("bad configuration", 400)],
        ["a rate limit", new OnshapeRateLimitError("slow down", 60)],
        ["a timeout", new OnshapeTimeoutError()],
        ["our own failure", new TypeError("undefined is not a function")]
    ])("does not retry %s", async (_label, error) => {
        const call = vi.fn().mockRejectedValue(error);

        await expect(retryOnServerError(call, NO_WAIT)).rejects.toBe(error);
        expect(call).toHaveBeenCalledTimes(1);
    });
});
