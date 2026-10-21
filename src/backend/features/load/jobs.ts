/**
 * Reloads, one per library at a time, and what each is doing. Load state is
 * ephemeral, so it lives in KV and the library's tables hold only what a load
 * wrote. KV has no compare-and-set: two reloads that claim a library in the
 * same instant both run, which is accepted.
 */
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { kvStore } from "../../lib/kv-store";
import { isWorkflowActive } from "../../lib/workflows";
import { bumpLibraryVersion, rebuildSearchDb } from "../library/db";
import type { LibraryId } from "../library/library-id";
import { pushJobStatus, pushLibraryChanged } from "../push/notify";
import type { JobStatus } from "./contract";
import { flagFailedLoads, publishLibraries } from "./flag";

export interface ReloadParams {
    libraryId: LibraryId;
    groupIds: string[];
    /** Who asked for the reload, whose session it tries first; see `getOnshapeApiFromContext`. */
    sessionId?: string;
    /** Reloads groups whose version has not changed, too. */
    forceReload: boolean;
    /** A webhook's new version, which waits for an editor's approval first. */
    held: boolean;
}

/** The reload holding a library, and the groups it has still to finish. */
export interface RunningReload {
    instanceId: string;
    startedAt: number;
    loadingGroupIds: string[];
}

/** A reload waiting for its turn, or for approval. */
interface QueuedReload {
    groupIds: string[];
    held: boolean;
}

/** A backstop for a reload that died holding the library; a read finds it sooner. */
const RUNNING_TTL_SECONDS = 24 * 60 * 60;

/** Outlasts `APPROVAL_TIMEOUT`, so a held reload is listed until it runs. */
const QUEUED_TTL_SECONDS = 8 * 24 * 60 * 60;

const running = kvStore<RunningReload>("library-reload", {
    ttlSeconds: RUNNING_TTL_SECONDS
});

/** Keyed `{libraryId}:{instanceId}`, so each reload writes only its own. */
const queued = kvStore<QueuedReload>("library-reload-queued", {
    ttlSeconds: QUEUED_TTL_SECONDS
});

const queuedId = (libraryId: LibraryId, instanceId: string) =>
    `${libraryId}:${instanceId}`;

/** What a held reload waits for; see `approveHeldReloads`. */
export const APPROVE_EVENT = "approve-version";

/** A version nobody approves in this long loads anyway. */
export const APPROVAL_TIMEOUT = "7 days";

/** How often a reload waiting for its turn checks the library again. */
export const TURN_INTERVAL = "30 seconds";

/** Starts a reload of the groups; it waits its turn if the library is busy. */
export async function requestReload(
    env: AppBindings,
    params: ReloadParams
): Promise<void> {
    if (params.groupIds.length === 0) {
        return;
    }
    const id = crypto.randomUUID();
    // Before the instance exists, so the status shows it from the start.
    await queued.put(env.KV, queuedId(params.libraryId, id), {
        groupIds: params.groupIds,
        held: params.held
    });
    try {
        await env.RELOAD_LIBRARY_WORKFLOW.create({ id, params });
    } catch (error) {
        // So every mark names a reload that exists.
        await queued.delete(env.KV, queuedId(params.libraryId, id));
        throw error;
    }
    await publishJobStatus(env, params.libraryId);
}

/**
 * Every mark names a reload that exists, and Workflows keeps it far longer
 * than the mark, so a failed read is transient and the reload is taken as live.
 */
async function isAlive(env: AppBindings, instanceId: string): Promise<boolean> {
    try {
        const instance = await env.RELOAD_LIBRARY_WORKFLOW.get(instanceId);
        return isWorkflowActive((await instance.status()).status);
    } catch (error) {
        console.warn(`Failed to read reload ${instanceId}`, error);
        return true;
    }
}

/** A reload that died holding the library: what it hadn't finished failed. */
async function abandon(
    env: AppBindings,
    libraryId: LibraryId,
    dead: RunningReload
): Promise<void> {
    await running.delete(env.KV, libraryId);
    await flagFailedLoads(env, dead.loadingGroupIds);
    await publishLibraries(env, [libraryId]);
}

/**
 * Takes the library for this reload, unless a live one holds it. Returns the
 * claim, or undefined to wait.
 */
export async function claimLibrary(
    env: AppBindings,
    params: ReloadParams,
    instanceId: string
): Promise<RunningReload | undefined> {
    const { libraryId } = params;
    const current = await running.get(env.KV, libraryId);
    if (current && current.instanceId !== instanceId) {
        if (await isAlive(env, current.instanceId)) {
            return undefined;
        }
        await abandon(env, libraryId, current);
    }
    const claim: RunningReload = {
        instanceId,
        startedAt: Date.now(),
        loadingGroupIds: params.groupIds
    };
    await running.put(env.KV, libraryId, claim);
    await queued.delete(env.KV, queuedId(libraryId, instanceId));
    await publishJobStatus(env, libraryId);
    return claim;
}

/** Approved or timed out: still waiting for its turn, but no longer held. */
export async function releaseHold(
    env: AppBindings,
    params: ReloadParams,
    instanceId: string
): Promise<void> {
    const id = queuedId(params.libraryId, instanceId);
    const reload = await queued.get(env.KV, id);
    if (reload) {
        await queued.put(env.KV, id, { ...reload, held: false });
    }
    await publishJobStatus(env, params.libraryId);
}

/**
 * Records the groups the reload has still to finish. Only the holder writes
 * the claim, so this overwrites rather than reads.
 */
export async function reportProgress(
    env: AppBindings,
    libraryId: LibraryId,
    claim: RunningReload
): Promise<void> {
    await running.put(env.KV, libraryId, claim);
    await publishJobStatus(env, libraryId);
}

/**
 * Whether it failed or not. Publishes what it wrote, then releases the library
 * unless another reload took it.
 */
export async function finishReload(
    env: AppBindings,
    libraryId: LibraryId,
    instanceId: string,
    changed: boolean
): Promise<void> {
    const db = getDb(env.DB);
    // Before the bump, which makes /search-db immutable for a year.
    if (changed) {
        await rebuildSearchDb(env.BLOB, db, libraryId);
        await bumpLibraryVersion(db, libraryId);
        await pushLibraryChanged(env, libraryId);
    }
    const current = await running.get(env.KV, libraryId);
    if (current?.instanceId === instanceId) {
        await running.delete(env.KV, libraryId);
    }
    await queued.delete(env.KV, queuedId(libraryId, instanceId));
    await publishJobStatus(env, libraryId);
}

async function readQueued(
    env: AppBindings,
    libraryId: LibraryId
): Promise<{ instanceId: string; reload: QueuedReload }[]> {
    const ids = await queued.list(env.KV, `${libraryId}:`);
    const entries = await Promise.all(
        ids.map(async (id) => ({
            instanceId: id.slice(`${libraryId}:`.length),
            reload: await queued.get(env.KV, id)
        }))
    );
    return entries.flatMap(({ instanceId, reload }) =>
        reload ? [{ instanceId, reload }] : []
    );
}

/** Lets every held reload of the library through. Returns how many groups they hold. */
export async function approveHeldReloads(
    env: AppBindings,
    libraryId: LibraryId
): Promise<number> {
    const held = (await readQueued(env, libraryId)).filter(
        (each) => each.reload.held
    );
    await Promise.all(
        held.map(async ({ instanceId }) => {
            try {
                const instance =
                    await env.RELOAD_LIBRARY_WORKFLOW.get(instanceId);
                // An event sent before the reload reaches its wait is kept for it.
                await instance.sendEvent({ type: APPROVE_EVENT, payload: {} });
            } catch (error) {
                console.error(`Failed to approve reload ${instanceId}`, error);
            }
        })
    );
    return new Set(held.flatMap((each) => each.reload.groupIds)).size;
}

/** The groups loading or held, from the marks. */
function toStatus(
    current: RunningReload | undefined,
    waiting: { reload: QueuedReload }[]
): JobStatus {
    const loading = new Set(current?.loadingGroupIds ?? []);
    const held = new Set<string>();
    for (const { reload } of waiting) {
        for (const groupId of reload.groupIds) {
            (reload.held ? held : loading).add(groupId);
        }
    }
    return {
        loadingGroupIds: [...loading],
        awaitingApprovalGroupIds: [...held].filter((id) => !loading.has(id))
    };
}

async function publishJobStatus(
    env: AppBindings,
    libraryId: LibraryId
): Promise<void> {
    const [current, waiting] = await Promise.all([
        running.get(env.KV, libraryId),
        readQueued(env, libraryId)
    ]);
    await pushJobStatus(env, libraryId, toStatus(current, waiting));
}

/**
 * Asks Workflows about each reload rather than trusting the marks, since one
 * that died leaves its mark behind. Pushes keep the client current after this.
 */
export async function getJobStatus(
    env: AppBindings,
    libraryId: LibraryId
): Promise<JobStatus> {
    let current = await running.get(env.KV, libraryId);
    if (current && !(await isAlive(env, current.instanceId))) {
        await abandon(env, libraryId, current);
        current = undefined;
    }
    const waiting: { reload: QueuedReload }[] = [];
    for (const each of await readQueued(env, libraryId)) {
        if (await isAlive(env, each.instanceId)) {
            waiting.push(each);
        } else {
            await queued.delete(env.KV, queuedId(libraryId, each.instanceId));
        }
    }
    return toStatus(current, waiting);
}
