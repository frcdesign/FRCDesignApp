import { queryClient } from "../query-client";
import {
    contextDataQueryKey,
    getContextDataQuery,
    libraryQueryMatchKey
} from "../queries";
import { type ContextData } from "../../shared/types";

// A library reload/add-group workflow runs in the background and bumps the
// library's cacheVersion when it finishes (see finalizeLibrary). We watch for
// that bump to refresh the UI at completion — polling gently, since reloads can
// run for many minutes, and always with a hard cap so it never spins forever.
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_MS = 40 * 60 * 1000;

let pollHandle: ReturnType<typeof setInterval> | null = null;
let baselineCacheVersion = 0;
let deadline = 0;
let onComplete: (() => void) | undefined;

function cachedCacheVersion(): number | undefined {
    return queryClient.getQueryData<ContextData>(contextDataQueryKey())
        ?.accessData.cacheVersion;
}

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

    let data: ContextData;
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

/**
 * After a reload/add-group workflow is triggered, refreshes the library view
 * once the workflow finishes (detected via the library's cacheVersion bump),
 * then stops. Bounded by a hard cap so it never polls forever. A second trigger
 * while polling simply re-baselines against the current version.
 */
export function refreshLibraryWhenReloadCompletes(callback?: () => void): void {
    const baseline = cachedCacheVersion();
    if (baseline === undefined) return;

    baselineCacheVersion = baseline;
    deadline = Date.now() + MAX_POLL_MS;
    onComplete = callback;

    if (pollHandle === null) {
        pollHandle = setInterval(() => void poll(), POLL_INTERVAL_MS);
    }
}
