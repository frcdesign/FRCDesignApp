/**
 * How the last FeatureScripts load went, for the owner's callout. Diagnostic
 * only, so in KV; nothing reads it to decide what to load.
 */
import type { AppBindings } from "../../lib/context";
import { kvStore } from "../../lib/kv-store";
import { pushFeatureScriptsLoad } from "../push/notify";
import type { FeatureScriptsLoadStatus } from "./contract";

const STATUS_KEY = "frontend";

/** Loads are rare, so the last one is kept long enough to still be there when the owner looks. */
const statuses = kvStore<FeatureScriptsLoadStatus>(
    "featurescripts-load-status",
    { ttlSeconds: 30 * 24 * 60 * 60 }
);

export function getLoadStatus(
    env: AppBindings
): Promise<FeatureScriptsLoadStatus | undefined> {
    return statuses.get(env.KV, STATUS_KEY);
}

/** Replaces the last status and tells clients it moved. */
export async function reportLoadStatus(
    env: AppBindings,
    status: FeatureScriptsLoadStatus
): Promise<void> {
    await statuses.put(env.KV, STATUS_KEY, status);
    await pushFeatureScriptsLoad(env);
}
