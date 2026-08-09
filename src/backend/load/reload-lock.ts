import type { AppBindings } from "../app";
import type { LibraryId } from "../../shared/types";

/** Safety net so a crashed run's key eventually clears; longer than any load. */
const RELOAD_JOB_TTL_SECONDS = 60 * 60;

/** Instance statuses that mean a reload is still live. */
const ACTIVE_STATUSES = new Set([
    "queued",
    "running",
    "paused",
    "waiting",
    "waitingForPause"
]);

function reloadJobKey(libraryId: LibraryId): string {
    return `reload-job:${libraryId}`;
}

/**
 * Whether a reload workflow is still running for this library. Reads the stored
 * instance id and queries its live status; a missing id or aged-out instance
 * counts as not running.
 */
export async function isReloadRunning(
    env: AppBindings,
    libraryId: LibraryId
): Promise<boolean> {
    const instanceId = await env.KV.get(reloadJobKey(libraryId));
    if (!instanceId) return false;
    try {
        const instance = await env.LOAD_LIBRARY_WORKFLOW.get(instanceId);
        return ACTIVE_STATUSES.has((await instance.status()).status);
    } catch {
        return false;
    }
}

/** Records the reload workflow instance now running for this library. */
export function markReloadRunning(
    env: AppBindings,
    libraryId: LibraryId,
    instanceId: string
): Promise<void> {
    return env.KV.put(reloadJobKey(libraryId), instanceId, {
        expirationTtl: RELOAD_JOB_TTL_SECONDS
    });
}
