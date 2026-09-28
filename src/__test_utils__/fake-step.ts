import type { WorkflowStep } from "cloudflare:workers";

/** Runs each step inline; durability and retries are Cloudflare's concern. */
export const FAKE_STEP = {
    do: (_name: string, optionsOrFn: unknown, maybeFn?: unknown) => {
        const run = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
        return (run as () => unknown)();
    }
} as unknown as WorkflowStep;
