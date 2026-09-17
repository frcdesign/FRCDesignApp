/** Finding the insert location in an assembly, and working out where it sits. */
import { INSERT_LOCATION_SKETCH_ID, INSERT_LOCATION_SOURCE } from "./contract";
import { OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";

/** The instance type Onshape gives a sketch inserted into an assembly. */
const FEATURE_INSTANCE = "Feature";

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

/**
 * The marker's instance, matched on the tab and sketch it came from rather than
 * on its name, which anybody can rename. The version is left out of the match:
 * an assembly can hold a marker inserted from an older one.
 */
export function findInsertLocationInstance(
    assembly: OnshapeAssemblyDefinition
): OnshapeAssemblyInstance | undefined {
    return assembly.rootAssembly.instances.find(
        (instance) =>
            instance.type === FEATURE_INSTANCE &&
            !instance.suppressed &&
            instance.documentId === INSERT_LOCATION_SOURCE.documentId &&
            instance.elementId === INSERT_LOCATION_SOURCE.elementId &&
            instance.featureId === INSERT_LOCATION_SKETCH_ID
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
