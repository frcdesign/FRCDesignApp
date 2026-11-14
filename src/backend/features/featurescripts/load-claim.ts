/**
 * One load of the FeatureScripts at a time. KV has no compare-and-set: two
 * loads that claim in the same instant both run, which is accepted, as for a
 * library's reloads.
 */
import type { AppBindings } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { isWorkflowActive } from "../../lib/workflows";

export interface LoadFeatureScriptsParams {
    /** Who asked, whose session it reads with; absent for a webhook's run. */
    sessionId?: string;
    /** Reloads every feature, unchanged or not. */
    force: boolean;
}

interface RunningLoad {
    instanceId: string;
}

const CLAIM_KEY = "frontend";

/** A backstop for a load that died holding the claim; a read finds it sooner. */
const running = kvStore<RunningLoad>("featurescripts-load", {
    ttlSeconds: 24 * 60 * 60
});

/** How often a load waiting its turn checks again. */
export const LOAD_TURN_INTERVAL = "30 seconds";

/** Starts a load, which waits its turn behind one already running. */
export async function requestFeatureScriptsLoad(
    env: AppBindings,
    params: LoadFeatureScriptsParams
): Promise<void> {
    await env.LOAD_FEATURESCRIPTS_WORKFLOW.create({ params });
}

/** A failed read is taken as live: Workflows keeps an instance far longer than the claim. */
async function isAlive(env: AppBindings, instanceId: string): Promise<boolean> {
    try {
        const instance = await env.LOAD_FEATURESCRIPTS_WORKFLOW.get(instanceId);
        return isWorkflowActive((await instance.status()).status);
    } catch (error) {
        console.warn(`Failed to read FeatureScripts load ${instanceId}`, error);
        return true;
    }
}

/** Takes the load for this run unless a live one holds it; false to wait. */
export async function claimLoad(
    env: AppBindings,
    instanceId: string
): Promise<boolean> {
    const current = await running.get(env.KV, CLAIM_KEY);
    if (
        current &&
        current.instanceId !== instanceId &&
        (await isAlive(env, current.instanceId))
    ) {
        return false;
    }
    await running.put(env.KV, CLAIM_KEY, { instanceId });
    return true;
}

/** Only the run holding the load releases it. */
export async function releaseLoad(
    env: AppBindings,
    instanceId: string
): Promise<void> {
    const current = await running.get(env.KV, CLAIM_KEY);
    if (current?.instanceId === instanceId) {
        await running.delete(env.KV, CLAIM_KEY);
    }
}
