import { ElementType, FastenInfo, MateLocation } from "../../shared/types";
import { type ElementPath } from "../../shared/onshape-path";
import { getAssembly } from "../onshape-api/endpoints/assemblies";
import { getFeatures } from "../onshape-api/endpoints/part-studios";
import {
    featureOccurrenceQuery,
    partStudioMateConnectorQuery
} from "../onshape-api/objects/assembly-features";
import { OnshapeApi } from "../onshape-api/onshape-api";
import {
    OnshapeAssemblyDefinition,
    OnshapeAssemblyFeature
} from "../onshape-api/types/assemblies";
import { OnshapeFeatureListResponse } from "../onshape-api/types/part-studios";

export async function parseFastenInfo(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType
): Promise<FastenInfo> {
    if (elementType === ElementType.PART_STUDIO) {
        const rawFeatureList = await getFeatures(onshapeApi, elementPath);
        return parseFastenInfoFromPartStudio(rawFeatureList);
    } else {
        const rawAssemblyInfo = await getAssembly(onshapeApi, elementPath, {
            includeMateConnectors: true,
            includeMateFeatures: true
        });
        return parseFastenInfoFromAssembly(rawAssemblyInfo);
    }
}

function searchFeatures(
    features: OnshapeAssemblyFeature[],
    mateLocation: MateLocation,
    path: string[] = []
): FastenInfo | undefined {
    for (const feature of features) {
        if (feature.featureType === "mateConnector") {
            const fullPath = [
                ...path,
                ...(feature.featureData?.occurrence ?? [])
            ];
            return {
                mateConnectorId: feature.id,
                mateLocation,
                path: fullPath
            };
        }
    }
    return undefined;
}

export function parseFastenInfoFromPartStudio(
    rawFeatureList: OnshapeFeatureListResponse
): FastenInfo {
    for (const feature of rawFeatureList.features) {
        if (feature.featureType === "mateConnector") {
            return {
                mateConnectorId: feature.featureId,
                mateLocation: MateLocation.Feature,
                path: []
            };
        }
    }
    throw new Error("Failed to find a valid Mate connector feature.");
}

export function parseFastenInfoFromAssembly(
    rawAssemblyInfo: OnshapeAssemblyDefinition
): FastenInfo {
    const rootAssembly = rawAssemblyInfo.rootAssembly;
    const fromFeatures = searchFeatures(
        rootAssembly.features,
        MateLocation.Feature
    );
    if (fromFeatures) return fromFeatures;

    const parts = rawAssemblyInfo.parts;
    const subAssemblies = rawAssemblyInfo.subAssemblies;
    let partCounter = 0;
    let subAssemblyCounter = 0;

    for (const instance of rootAssembly.instances) {
        const path = [instance.id];
        if (instance.type === "Part") {
            const part = parts[partCounter++];
            const mateConnectors = part.mateConnectors ?? [];
            if (mateConnectors.length > 0) {
                return {
                    mateConnectorId: mateConnectors[0].featureId,
                    path,
                    mateLocation: MateLocation.Part
                };
            }
        } else if (instance.type === "Assembly") {
            const subAssembly = subAssemblies[subAssemblyCounter++];
            const found = searchFeatures(
                subAssembly.features,
                MateLocation.Subassembly,
                path
            );
            if (found) return found;
        }
    }
    throw new Error(
        "Failed to find a valid Mate connector feature or instance."
    );
}

export function getFastenQuery(
    targetElementType: ElementType,
    path: string[],
    fastenInfo: FastenInfo
): object {
    if (targetElementType === ElementType.PART_STUDIO) {
        return partStudioMateConnectorQuery(fastenInfo.mateConnectorId, path);
    }

    const assemblyPath = [...path, ...fastenInfo.path];
    if (fastenInfo.mateLocation === MateLocation.Part) {
        return partStudioMateConnectorQuery(
            fastenInfo.mateConnectorId,
            assemblyPath
        );
    }
    return featureOccurrenceQuery(fastenInfo.mateConnectorId, assemblyPath);
}
