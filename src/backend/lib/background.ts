import type { AppContext } from "./context";

/**
 * Runs `work` after the response, for what the caller need not wait on. Its
 * errors are logged, never thrown. Awaits when there is no execution context.
 */
export async function runInBackground(
    c: AppContext,
    description: string,
    work: () => Promise<void>
): Promise<void> {
    const guarded = work().catch((error: unknown) => {
        console.error(`Failed to ${description}`, error);
    });
    try {
        c.executionCtx.waitUntil(guarded);
    } catch {
        await guarded;
    }
}
