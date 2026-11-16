import { afterEach, describe, expect, it, vi } from "vitest";
import {
    OnshapeApiError,
    OnshapeRateLimitError,
    OnshapeTimeoutError
} from "./client";
import { retryInsert } from "./retry";
import { ApiErrorKind } from "../api-error";

const NO_WAIT = { retries: 1, delayMs: 0, timeoutMs: 60_000 };
const TIMED_OUT = "Onshape timed out.";

describe("retryInsert", () => {
    afterEach(() => vi.restoreAllMocks());

    it("calls again after a 5xx", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValueOnce(new OnshapeApiError("boom", 500))
            .mockResolvedValueOnce("inserted");

        await expect(retryInsert(call, TIMED_OUT, NO_WAIT)).resolves.toBe(
            "inserted"
        );
        expect(call).toHaveBeenCalledTimes(2);
    });

    it("gives each attempt the policy's timeout", async () => {
        const call = vi.fn().mockResolvedValue("inserted");

        await retryInsert(call, TIMED_OUT, NO_WAIT);

        expect(call).toHaveBeenCalledWith(60_000);
    });

    it("gives up once its retries are spent", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValue(new OnshapeApiError("boom", 503));

        await expect(
            retryInsert(call, TIMED_OUT, NO_WAIT)
        ).rejects.toMatchObject({ status: 503 });
        expect(call).toHaveBeenCalledTimes(2);
    });

    it("words a timed-out insert, without calling again", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const call = vi
            .fn()
            .mockRejectedValueOnce(new OnshapeTimeoutError(60_000))
            .mockResolvedValueOnce("inserted");

        await expect(
            retryInsert(call, TIMED_OUT, NO_WAIT)
        ).rejects.toMatchObject({
            status: 504,
            body: { kind: ApiErrorKind.HANDLED, message: TIMED_OUT }
        });
        expect(call).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["a 4xx", new OnshapeApiError("bad configuration", 400)],
        ["a rate limit", new OnshapeRateLimitError("slow down", 60)],
        ["our own failure", new TypeError("undefined is not a function")]
    ])("does not retry %s", async (_label, error) => {
        const call = vi.fn().mockRejectedValue(error);

        await expect(retryInsert(call, TIMED_OUT, NO_WAIT)).rejects.toBe(error);
        expect(call).toHaveBeenCalledTimes(1);
    });
});
