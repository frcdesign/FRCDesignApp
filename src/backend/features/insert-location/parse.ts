/** Finding the insert location in an assembly, and working out where it sits. */
import { INSERT_LOCATION_NAME } from "./contract";
import { OnshapeApi } from "../../lib/onshape/client";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { type ElementPath } from "../../lib/onshape/path";
import { toTransform } from "../../lib/onshape/objects/transform";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyFeature
} from "../../lib/onshape/types";

const MATE_CONNECTOR = "mateConnector";

/**
 * The assembly, asked for the way the insert location needs it:
 * `includeMateFeatures` is what puts the connectors in the feature list, and
 * `includeMateConnectors` is what puts each one's coordinate system with it.
 */
function getAssemblyMateConnectors(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath
): Promise<OnshapeAssemblyDefinition> {
    return getAssembly(onshapeApi, assemblyPath, {
        includeMateFeatures: true,
        includeMateConnectors: true
    });
}

function getMateConnectors(
    assembly: OnshapeAssemblyDefinition
): OnshapeAssemblyFeature[] {
    return assembly.rootAssembly.features.filter(
        (feature) =>
            feature.featureType === MATE_CONNECTOR && !feature.suppressed
    );
}

/** The insert location connector, by the name the app gives it when adding one. */
export function findInsertLocationFeature(
    assembly: OnshapeAssemblyDefinition
): OnshapeAssemblyFeature | undefined {
    return getMateConnectors(assembly).find(
        (connector) => connector.featureData?.name === INSERT_LOCATION_NAME
    );
}

/**
 * Where a connector sits, as a transform an insert can be placed by. Undefined
 * when the connector is gone, or when Onshape sent no coordinate system with it
 * — the insert then lands at the origin rather than failing.
 */
export function getMateConnectorTransform(
    assembly: OnshapeAssemblyDefinition,
    mateConnectorId: string
): number[] | undefined {
    const connector = getMateConnectors(assembly).find(
        (candidate) => candidate.id === mateConnectorId
    );
    return toTransform(connector?.featureData?.mateConnectorCS);
}

/** {@link findInsertLocationFeature} against the assembly as it is now. */
export async function findInsertLocation(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath
): Promise<string | undefined> {
    const assembly = await getAssemblyMateConnectors(onshapeApi, assemblyPath);
    return findInsertLocationFeature(assembly)?.id;
}

/**
 * Where the insert location is now, which only Onshape knows: the caller has
 * the connector's id, and it moves whenever somebody drags it.
 */
export async function getInsertLocationTransform(
    onshapeApi: OnshapeApi,
    assemblyPath: ElementPath,
    mateConnectorId: string
): Promise<number[] | undefined> {
    const assembly = await getAssemblyMateConnectors(onshapeApi, assemblyPath);
    return getMateConnectorTransform(assembly, mateConnectorId);
}
