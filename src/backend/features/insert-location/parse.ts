/** Finding the insert location in an assembly, and working out where it sits. */
import { INSERT_LOCATION_SOURCE } from "./contract";
import { OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
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

/** Undefined when the marker was deleted, so the insert lands at the origin. */
function getInstanceTransform(
    assembly: OnshapeAssemblyDefinition,
    instanceId: string
): number[] | undefined {
    return assembly.rootAssembly.occurrences?.find(
        (occurrence) =>
            occurrence.path.length === 1 && occurrence.path[0] === instanceId
    )?.transform;
}

/** The marker's instance id in the assembly as it is now. */
export async function findInsertLocation(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath
): Promise<string | undefined> {
    const assembly = await getAssemblyWithMarkers(onshapeApi, assemblyPath);
    return findInsertLocationInstance(assembly)?.id;
}

/** Asked of Onshape, since the marker moves whenever someone drags it. */
export async function getInsertLocationTransform(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath,
    instanceId: string
): Promise<number[] | undefined> {
    const assembly = await getAssemblyWithMarkers(onshapeApi, assemblyPath);
    return getInstanceTransform(assembly, instanceId);
}
