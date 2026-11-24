/**
 * Finding the insert location in an assembly, and working out where it sits,
 * from the assembly as Auto Assembly reads and caches it, so asking again
 * between its edits reads only the workspace's tabs.
 */
import { INSERT_LOCATION_SOURCE } from "./contract";
import { readAssembly } from "../auto-assembly/assembly-read";
import { OnshapeApi } from "../../lib/onshape/client";
import { type ElementPath } from "../../lib/onshape/path";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";

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

/** An assembly as it is now: its marker, and where each top-level instance sits. */
interface Placement {
    instanceId?: string;
    /** By instance id; the marker's is among them. */
    transforms: Record<string, number[]>;
}

/** Read through Auto Assembly's cache, so an insert and its fasten read the assembly once. */
async function readPlacement(
    onshapeApi: OnshapeApi,
    kv: KVNamespace,
    assemblyPath: ElementPath
): Promise<Placement> {
    const { definition } = await readAssembly(onshapeApi, kv, assemblyPath);
    return {
        instanceId: findInsertLocationInstance(definition)?.id,
        transforms: Object.fromEntries(
            (definition.rootAssembly.occurrences ?? [])
                .filter((occurrence) => occurrence.path.length === 1)
                .map((occurrence) => [occurrence.path[0], occurrence.transform])
        )
    };
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
 * The marker's instance id as the assembly was last read, which an insert does
 * whenever it lands on the marker. Undefined when it has never been read.
 */
export async function findLastInsertLocation(
    onshapeApi: OnshapeApi,
    kv: KVNamespace,
    assemblyPath: ElementPath
): Promise<string | undefined> {
    const { definition } = await readAssembly(onshapeApi, kv, assemblyPath, []);
    return findInsertLocationInstance(definition)?.id;
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
