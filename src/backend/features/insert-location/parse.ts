/**
 * Finding the insert location in an assembly, and working out where it sits,
 * cached by what pins the assembly tab, so asking again between its edits reads
 * only the workspace's tabs.
 */
import { INSERT_LOCATION_SOURCE } from "./contract";
import { kvStore, putQuietly } from "../../lib/kv-store";
import { OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import { pinElement } from "../../lib/onshape/pin";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";

/** Sketches aren't solids, so the marker needs `includeNonSolids`. */
function getAssemblyWithMarkers(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath
): Promise<OnshapeAssemblyDefinition> {
    return getAssembly(onshapeApi, assemblyPath, { includeNonSolids: true });
}

/** Whether something an assembly names came from the marker's tab. */
function isFromSourceTab(reference: {
    documentId?: string;
    elementId?: string;
}): boolean {
    return (
        reference.documentId === INSERT_LOCATION_SOURCE.documentId &&
        reference.elementId === INSERT_LOCATION_SOURCE.elementId
    );
}

/**
 * Matched on the source tab, not the name (renameable), version (an older
 * marker still counts) or feature id (could go stale). Onshape doesn't document
 * which fields a sketch instance fills in, so both the instance and its
 * `partStudioFeatures` entry are checked.
 */
function findInsertLocationInstance(
    assembly: OnshapeAssemblyDefinition
): OnshapeAssemblyInstance | undefined {
    const markerFeatureIds = new Set(
        (assembly.partStudioFeatures ?? [])
            .filter(isFromSourceTab)
            .map((feature) => feature.featureId)
            .filter((featureId) => featureId !== undefined)
    );

    return assembly.rootAssembly.instances.find(
        (instance) =>
            !instance.suppressed &&
            (isFromSourceTab(instance) ||
                (instance.featureId !== undefined &&
                    markerFeatureIds.has(instance.featureId)))
    );
}

/** An assembly at one pin: its marker, and where each top-level instance sits. */
interface Placement {
    instanceId?: string;
    /** By instance id; the marker's is among them. */
    transforms: Record<string, number[]>;
}

/** A week: a pin is never stale, so this only bounds what's kept of assemblies edited since. */
const PLACEMENT_TTL_SECONDS = 7 * 24 * 60 * 60;

const placements = kvStore<Placement>("insert-location", {
    ttlSeconds: PLACEMENT_TTL_SECONDS
});

/** From the cache when the assembly tab hasn't changed since it was last read. */
async function readPlacement(
    onshapeApi: OnshapeApi,
    kv: KVNamespace,
    assemblyPath: ElementPath
): Promise<Placement> {
    const { pin } = await pinElement(onshapeApi, assemblyPath);
    const cached = pin ? await placements.get(kv, pin) : undefined;
    if (cached) {
        return cached;
    }
    const assembly = await getAssemblyWithMarkers(onshapeApi, assemblyPath);
    const placement: Placement = {
        instanceId: findInsertLocationInstance(assembly)?.id,
        transforms: Object.fromEntries(
            (assembly.rootAssembly.occurrences ?? [])
                .filter((occurrence) => occurrence.path.length === 1)
                .map((occurrence) => [occurrence.path[0], occurrence.transform])
        )
    };
    if (pin) {
        await putQuietly(placements, kv, pin, placement);
    }
    return placement;
}

/** The marker's instance id in the assembly as it is now. */
export async function findInsertLocation(
    onshapeApi: OnshapeApi,
    kv: KVNamespace,
    assemblyPath: ElementPath
): Promise<string | undefined> {
    return (await readPlacement(onshapeApi, kv, assemblyPath)).instanceId;
}

/**
 * At the assembly as it is now, since the marker moves whenever someone drags
 * it. Undefined when the marker was deleted, so the insert lands at the origin.
 */
export async function getInsertLocationTransform(
    onshapeApi: OnshapeApi,
    kv: KVNamespace,
    assemblyPath: ElementPath,
    instanceId: string
): Promise<number[] | undefined> {
    const { transforms } = await readPlacement(onshapeApi, kv, assemblyPath);
    return Object.hasOwn(transforms, instanceId)
        ? transforms[instanceId]
        : undefined;
}
