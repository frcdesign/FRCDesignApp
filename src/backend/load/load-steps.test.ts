import { describe, expect, it } from "vitest";
import { OnshapeRateLimitError } from "../onshape-api/onshape-api";
import { NoSuchConfigurationError } from "../onshape-api/endpoints/thumbnails";
import { ONSHAPE_STEP_RETRIES, THUMBNAIL_STEP_RETRIES } from "./load-steps";

/** The delay before the retry that follows attempt `attempt`. */
function thumbnailDelay(attempt: number, error = new Error("not rendered")) {
    return THUMBNAIL_STEP_RETRIES.delay({ ctx: { attempt }, error });
}

describe("THUMBNAIL_STEP_RETRIES", () => {
    // Onshape gives no signal when a render lands, so the step polls. Doubling
    // from four seconds keeps the common case — a render that finishes in a few
    // seconds — from sitting unnoticed behind a long first wait.
    it("doubles from four seconds", () => {
        expect([1, 2, 3, 4, 5, 6].map((a) => thumbnailDelay(a))).toEqual([
            "4 seconds",
            "8 seconds",
            "16 seconds",
            "32 seconds",
            "64 seconds",
            "128 seconds"
        ]);
    });

    it("stops doubling at five minutes", () => {
        expect(thumbnailDelay(7)).toEqual("256 seconds");
        expect(thumbnailDelay(8)).toEqual("300 seconds");
        expect(thumbnailDelay(50)).toEqual("300 seconds");
    });

    // A tab Onshape never renders holds its library's reload open for this
    // long, so the budget is a load-time cost, not just a thumbnail one.
    it("polls for about eight minutes before giving up", () => {
        const total = Array.from(
            { length: THUMBNAIL_STEP_RETRIES.limit - 1 },
            (_, i) => Number.parseInt(thumbnailDelay(i + 1), 10)
        ).reduce((sum, seconds) => sum + seconds, 0);

        expect(total).toBe(508);
    });

    // A warm request naming a configuration that matches nothing would
    // otherwise hold a workflow instance for the whole budget.
    it("does not wait on a configuration that matches nothing", () => {
        const error = new NoSuchConfigurationError("no insertable");
        expect(thumbnailDelay(1, error)).toEqual("0 seconds");
        expect(thumbnailDelay(6, error)).toEqual("0 seconds");
    });

    // Polling sooner than Onshape asked only earns another 429.
    it("waits out a rate limit instead of its own curve", () => {
        const error = new OnshapeRateLimitError("slow down", 42);
        expect(thumbnailDelay(1, error)).toEqual("42 seconds");
        expect(thumbnailDelay(9, error)).toEqual("42 seconds");
    });
});

describe("ONSHAPE_STEP_RETRIES", () => {
    it("backs off from ten seconds, capped at five minutes", () => {
        const delay = (attempt: number) =>
            ONSHAPE_STEP_RETRIES.delay({
                ctx: { attempt },
                error: new Error("boom")
            });
        expect([1, 2, 3, 10].map(delay)).toEqual([
            "10 seconds",
            "20 seconds",
            "40 seconds",
            "300 seconds"
        ]);
    });

    it("waits out a rate limit instead of its own curve", () => {
        expect(
            ONSHAPE_STEP_RETRIES.delay({
                ctx: { attempt: 3 },
                error: new OnshapeRateLimitError("slow down", 7)
            })
        ).toEqual("7 seconds");
    });
});
