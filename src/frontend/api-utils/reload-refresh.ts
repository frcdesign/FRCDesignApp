import { queryClient } from "../query-client";
import { getContextDataQuery, libraryQueryMatchKey } from "../queries";

// How often to poll the backend while a load job is running.
const POLL_INTERVAL_MS = 10_000;
// Hard cap so polling never spins forever if the job never finishes.
const MAX_POLL_MS = 40 * 60 * 1000;

let pollHandle: ReturnType<typeof setInterval> | null = null;
let baselineCacheVersion = 0;
let deadline = 0;
let onComplete: (() => void) | undefined;

function stopPolling(): void {
    if (pollHandle !== null) {
        clearInterval(pollHandle);
        pollHandle = null;
    }
}

async function poll(): Promise<void> {
    if (Date.now() > deadline) {
        stopPolling();
        return;
    }

    let data;
    try {
        data = await queryClient.fetchQuery(getContextDataQuery());
    } catch {
        return; // Transient failure — try again on the next tick.
    }

    if (data.accessData.cacheVersion !== baselineCacheVersion) {
        stopPolling();
        await queryClient.invalidateQueries({
            queryKey: libraryQueryMatchKey()
        });
        onComplete?.();
    }
}

/** Refreshes the library view once a triggered workflow bumps the cacheVersion past `baselineVersion`. */
export function refreshLibraryWhenReloadCompletes(
    baselineVersion: number,
    callback?: () => void
): void {
    baselineCacheVersion = baselineVersion;
    deadline = Date.now() + MAX_POLL_MS;
    onComplete = callback;

    if (pollHandle === null) {
        pollHandle = setInterval(() => void poll(), POLL_INTERVAL_MS);
    }
}
