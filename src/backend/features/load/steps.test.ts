import { describe, expect, it } from "vitest";
import { OnshapeRateLimitError } from "../../lib/onshape/client";
import { ONSHAPE_STEP_RETRIES } from "./steps";

const secondsOf = (delay: string) => Number.parseInt(delay, 10);

/** The spread `rateLimitDelay` adds on top of what Onshape asked for. */
const JITTER_SECONDS = 20;

// A poll capped at two minutes waited four hours between attempts until these
// were pinned; see CONSTANT_BACKOFF for what the platform was adding.
describe("every retry config", () => {
    it("leaves the platform no curve to apply on top", () => {
        for (const retries of [ONSHAPE_STEP_RETRIES]) {
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
