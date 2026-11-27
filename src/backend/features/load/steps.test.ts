import { describe, expect, it } from "vitest";
import { OnshapeRateLimitError } from "../../lib/onshape/client";
import { ONSHAPE_STEP_RETRIES } from "./steps";

const secondsOf = (delay: string) => Number.parseInt(delay, 10);

/** The spread `rateLimitDelay` adds on top of what Onshape asked for. */
const JITTER_SECONDS = 20;

// Any curve multiplies the delay; see CONSTANT_BACKOFF.
describe("every retry config", () => {
    it("leaves the platform no curve to apply on top", () => {
        for (const retries of [ONSHAPE_STEP_RETRIES]) {
            expect(retries.backoff).toBe("constant");
        }
    });
});

describe("ONSHAPE_STEP_RETRIES", () => {
    it("retries once, two seconds later", () => {
        expect(ONSHAPE_STEP_RETRIES.limit).toBe(1);
        expect(
            ONSHAPE_STEP_RETRIES.delay({
                ctx: { attempt: 1 },
                error: new Error("boom")
            })
        ).toBe("2 seconds");
    });

    it("waits out a rate limit instead", () => {
        const delay = secondsOf(
            ONSHAPE_STEP_RETRIES.delay({
                ctx: { attempt: 1 },
                error: new OnshapeRateLimitError("slow down", 7)
            })
        );
        expect(delay).toBeGreaterThanOrEqual(7);
        expect(delay).toBeLessThanOrEqual(7 + JITTER_SECONDS);
    });

    // What Workflows actually passes the callback: a rebuilt Error, not the instance.
    it("waits out a rate limit Workflows rebuilt as a plain Error", () => {
        const rebuilt = new Error(
            new OnshapeRateLimitError("slow down", 450).message
        );
        const delay = secondsOf(
            ONSHAPE_STEP_RETRIES.delay({ ctx: { attempt: 3 }, error: rebuilt })
        );
        expect(delay).toBeGreaterThanOrEqual(450);
        expect(delay).toBeLessThanOrEqual(450 + JITTER_SECONDS);
    });

    // Workflows may prefix the name when it rebuilds the message.
    it("reads the wait out of a name-prefixed message", () => {
        const rebuilt = new Error(
            `OnshapeRateLimitError: ${new OnshapeRateLimitError("slow down", 90).message}`
        );
        const delay = secondsOf(
            ONSHAPE_STEP_RETRIES.delay({ ctx: { attempt: 2 }, error: rebuilt })
        );
        expect(delay).toBeGreaterThanOrEqual(90);
        expect(delay).toBeLessThanOrEqual(90 + JITTER_SECONDS);
    });
});
