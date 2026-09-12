import { describe, expect, it } from "vitest";
import { OnshapeRateLimitError } from "../../lib/onshape/client";
import { ONSHAPE_STEP_RETRIES, THUMBNAIL_STEP_RETRIES } from "./steps";

/** The delay before the retry that follows attempt `attempt`. */
function thumbnailDelay(attempt: number, error = new Error("not rendered")) {
    return THUMBNAIL_STEP_RETRIES.delay({ ctx: { attempt }, error });
}

const secondsOf = (delay: string) => Number.parseInt(delay, 10);

/** The spread `rateLimitDelay` adds on top of what Onshape asked for. */
const JITTER_SECONDS = 20;

describe("THUMBNAIL_STEP_RETRIES", () => {
    // Onshape gives no signal when a render lands, so the step polls. Starting
    // at five seconds keeps a quick render from waiting on a long first delay.
    it("doubles from five seconds", () => {
        expect([1, 2, 3, 4, 5].map((a) => thumbnailDelay(a))).toEqual([
            "5 seconds",
            "10 seconds",
            "20 seconds",
            "40 seconds",
            "80 seconds"
        ]);
    });

    // Uncapped, the last waits outgrow the renders themselves, leaving a
    // thumbnail that landed early unnoticed for minutes.
    it("stops doubling at five minutes", () => {
        expect(thumbnailDelay(7)).toEqual("300 seconds");
        expect(thumbnailDelay(12)).toEqual("300 seconds");
    });

    // The limit is what ends the poll: the step timeout covers an attempt, not
    // the waits between them.
    it("gives up about twenty minutes in", () => {
        const total = Array.from(
            { length: THUMBNAIL_STEP_RETRIES.limit - 1 },
            (_, i) => Number.parseInt(thumbnailDelay(i + 1), 10)
        ).reduce((sum, seconds) => sum + seconds, 0);

        expect(total).toBe(1215);
    });

    // Polling sooner than Onshape asked only earns another 429.
    it("waits out a rate limit instead of its own curve", () => {
        const error = new OnshapeRateLimitError("slow down", 42);
        expect(secondsOf(thumbnailDelay(1, error))).toBeGreaterThanOrEqual(42);
        expect(secondsOf(thumbnailDelay(9, error))).toBeGreaterThanOrEqual(42);
    });

    // Onshape hands every step caught in one burst the same Retry-After. Waiting
    // exactly that long has them all re-send at the same instant, which is how a
    // load that tripped the limit once keeps tripping it.
    it("spreads rate-limited retries rather than waking together", () => {
        const error = new OnshapeRateLimitError("slow down", 42);
        const delays = Array.from({ length: 50 }, () =>
            secondsOf(thumbnailDelay(1, error))
        );

        expect(new Set(delays).size).toBeGreaterThan(1);
        expect(Math.min(...delays)).toBeGreaterThanOrEqual(42);
        expect(Math.max(...delays)).toBeLessThanOrEqual(42 + JITTER_SECONDS);
    });
});

// A poll capped at two minutes waited four hours between attempts until these
// were pinned; see CONSTANT_BACKOFF for what the platform was adding.
describe("every retry config", () => {
    it("leaves the platform no curve to apply on top", () => {
        for (const retries of [ONSHAPE_STEP_RETRIES, THUMBNAIL_STEP_RETRIES]) {
            expect(retries.backoff).toBe("constant");
        }
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
        const delay = secondsOf(
            ONSHAPE_STEP_RETRIES.delay({
                ctx: { attempt: 3 },
                error: new OnshapeRateLimitError("slow down", 7)
            })
        );
        expect(delay).toBeGreaterThanOrEqual(7);
        expect(delay).toBeLessThanOrEqual(7 + JITTER_SECONDS);
    });
});
