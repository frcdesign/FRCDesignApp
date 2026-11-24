/**
 * Workflow steps that fail at once on a rate limit no run should sleep
 * through. Onshape's daily lockout sends a `Retry-After` of about a day, and a
 * step retrying after it would hold the run, and its user, that long.
 */
import { type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { readRetryAfterSeconds } from "./onshape/failures";

/** A shorter wait is slept through, as each step's retry config does. */
const MAX_STEP_WAIT_SECONDS = 10 * 60;

/** Whether a 429 asks for a longer wait than a step sleeps through. */
export function isLongRateLimit(error: unknown): boolean {
    const wait =
        error instanceof Error ? readRetryAfterSeconds(error) : undefined;
    return wait !== undefined && wait > MAX_STEP_WAIT_SECONDS;
}

type StepCallback = (...args: unknown[]) => Promise<unknown>;

/** The message is kept whole, so whatever reports the run reads the wait from it. */
function failFast(callback: StepCallback): StepCallback {
    return async (...args) => {
        try {
            return await callback(...args);
        } catch (error) {
            if (isLongRateLimit(error)) {
                throw new NonRetryableError((error as Error).message);
            }
            throw error;
        }
    };
}

/** The same steps, each failing at once on a long rate limit instead of retrying after it. */
export function failFastOnLongLimits(step: WorkflowStep): WorkflowStep {
    return {
        // The callback is the one argument that's a function; config holds its own.
        do: (name: string, ...rest: unknown[]) =>
            (step.do as (name: string, ...rest: unknown[]) => unknown)(
                name,
                ...rest.map((arg) =>
                    typeof arg === "function"
                        ? failFast(arg as StepCallback)
                        : arg
                )
            ),
        sleep: (name, duration) => step.sleep(name, duration),
        sleepUntil: (name, timestamp) => step.sleepUntil(name, timestamp),
        waitForEvent: (name, options) => step.waitForEvent(name, options)
    } as WorkflowStep;
}
