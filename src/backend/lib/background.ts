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

/**
 * Awaits `work`, which also keeps running up to 30 s past a client
 * disconnect, which otherwise cancels it midway.
 */
export function finishEvenIfDisconnected<T>(
    c: AppContext,
    work: Promise<T>
): Promise<T> {
    try {
        // Its failure is the caller's to handle, through the promise returned.
        c.executionCtx.waitUntil(work.catch(() => undefined));
    } catch {
        // No execution context, as in tests: awaiting is all there is.
    }
    return work;
}
