/** Finding the insert location in an assembly, and working out where it sits. */
import { INSERT_LOCATION_SOURCE } from "./contract";
import { OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";

/**
 * The assembly as the insert location needs it. A sketch is not a solid, so
 * without `includeNonSolids` the marker is not in the response at all.
 */
export function getAssemblyWithMarkers(
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
 * The marker's instance, matched on the tab it came from rather than on its
 * name, which anybody can rename. The version is left out of the match: an
 * assembly can hold a marker inserted from an older one. So is the sketch's own
 * feature id — the tab holds nothing but that sketch, so anything an assembly
 * holds from it is a marker, and an id that has to be right is an id that can
 * go stale.
 *
 * Which fields Onshape fills in on a sketch instance is not something it
 * documents, and a marker that inserted fine was not found again, so both
 * places the tab can be named are accepted: the instance itself, and the
 * `partStudioFeatures` entry its `featureId` points at.
 */
export function findInsertLocationInstance(
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

/**
 * Where a top-level instance sits, as a transform an insert can be placed by.
 * Undefined when the instance is gone, which is what a marker deleted since the
 * app opened looks like — the insert then lands at the origin.
 */
export function getInstanceTransform(
    assembly: OnshapeAssemblyDefinition,
    instanceId: string
): number[] | undefined {
    return assembly.rootAssembly.occurrences?.find(
        (occurrence) =>
            occurrence.path.length === 1 && occurrence.path[0] === instanceId
    )?.transform;
}

/** {@link findInsertLocationInstance} against the assembly as it is now. */
export async function findInsertLocation(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath
): Promise<string | undefined> {
    const assembly = await getAssemblyWithMarkers(onshapeApi, assemblyPath);
    return findInsertLocationInstance(assembly)?.id;
}

/**
 * Where the insert location is now, which only Onshape knows: the caller has
 * the marker's instance id, and it moves whenever somebody drags it.
 */
export async function getInsertLocationTransform(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath,
    instanceId: string
): Promise<number[] | undefined> {
    const assembly = await getAssemblyWithMarkers(onshapeApi, assemblyPath);
    return getInstanceTransform(assembly, instanceId);
}
