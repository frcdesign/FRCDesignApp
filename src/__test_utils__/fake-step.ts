import type { WorkflowStep } from "cloudflare:workers";

/**
 * Runs each step inline, so the load functions can be exercised without a real
 * workflow. Durability and retries are Cloudflare's concern, not these tests'.
 */
export const FAKE_STEP = {
    do: (_name: string, optionsOrFn: unknown, maybeFn?: unknown) => {
        const run = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
        return (run as () => unknown)();
    }
} as unknown as WorkflowStep;
