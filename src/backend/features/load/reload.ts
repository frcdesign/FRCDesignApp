/**
 * Starting a library reload, for the admin button and for Onshape's webhooks.
 * A library runs one reload at a time; a document a webhook names while one is
 * running is queued for when it ends, since the running one may have checked
 * that document before its new version landed.
 */
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { ensureLibrary } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { getOwnerSessionId } from "../auth/owner";
import { isReloadRunning, trackJob } from "./job-tracker";

export interface ReloadRequest {
    /** Whose Onshape session the reload calls Onshape with. */
    sessionId: string;
    forceReload?: boolean;
    /** Only the groups loaded from these; every group when absent. */
    documentIds?: string[];
}

export type ReloadOutcome = "triggered" | "already-running";

export async function startReload(
    env: AppBindings,
    libraryId: LibraryId,
    request: ReloadRequest
): Promise<ReloadOutcome> {
    // Racy under a sub-second double trigger (KV has no compare-and-swap),
    // which is fine here.
    if (await isReloadRunning(env, libraryId)) {
        return "already-running";
    }
    await ensureLibrary(getDb(env.DB), libraryId);
    const instance = await env.LOAD_LIBRARY_WORKFLOW.create({
        params: { libraryId, ...request }
    });
    await trackJob(env, libraryId, "reload", instance.id);
    return "triggered";
}

function queueKey(libraryId: LibraryId): string {
    return `queued-reload:${libraryId}`;
}

/** Long enough to outlast any one reload, which is what drains the queue. */
const QUEUE_TTL_SECONDS = 60 * 60 * 24;

/**
 * Reloads the groups loaded from `documentIds` under the owner's session, now
 * or once the reload already running ends.
 */
export async function queueReload(
    env: AppBindings,
    libraryId: LibraryId,
    documentIds: string[]
): Promise<void> {
    const sessionId = await getOwnerSessionId(env.KV);
    if (!sessionId) {
        console.warn(
            `No owner session to reload ${libraryId} with; the owner has not used the app yet.`
        );
        return;
    }
    const outcome = await startReload(env, libraryId, {
        sessionId,
        documentIds
    });
    if (outcome === "already-running") {
        const queued = await readQueue(env, libraryId);
        await env.KV.put(
            queueKey(libraryId),
            JSON.stringify([...new Set([...queued, ...documentIds])]),
            { expirationTtl: QUEUE_TTL_SECONDS }
        );
    }
}

async function readQueue(
    env: AppBindings,
    libraryId: LibraryId
): Promise<string[]> {
    const raw = await env.KV.get(queueKey(libraryId));
    return raw ? (JSON.parse(raw) as string[]) : [];
}

/**
 * Starts whatever was queued while a reload ran. Called by that reload once it
 * no longer counts as running, so the reload this starts is not turned away.
 */
export async function startQueuedReload(
    env: AppBindings,
    libraryId: LibraryId
): Promise<void> {
    const documentIds = await readQueue(env, libraryId);
    if (documentIds.length === 0) {
        return;
    }
    await env.KV.delete(queueKey(libraryId));
    await queueReload(env, libraryId, documentIds);
}
