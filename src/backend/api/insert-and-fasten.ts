import { ElementType } from "../../frontend/api-utils/client-models";
import type { ElementPath } from "../../shared/path";
import { getAssembly } from "../onshape-api/endpoints/assemblies";
import { getFeatures } from "../onshape-api/endpoints/part-studios";

export function searchFeatures(
    features: any[],
    mateLocation: MateLocation,
    path: string[] = []
): FastenInfo | undefined {
    for (const feature of features) {
        if (feature.featureType === "mateConnector") {
            const fullPath = [...path, ...feature.featureData.occurrence];
            return {
                mateConnectorId: feature.id,
                mateLocation,
                path: fullPath
            };
        }
    }
    return undefined;
}
export function parseFastenInfoFromPartStudio(featureList: any): FastenInfo {
    for (const feature of featureList.features) {
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
export function parseFastenInfoFromAssembly(assemblyInfo: any): FastenInfo {
    const rootAssembly = assemblyInfo.rootAssembly;
    const fromFeatures = searchFeatures(
        rootAssembly.features,
        MateLocation.Feature
    );
    if (fromFeatures) return fromFeatures;

    const parts: any[] = assemblyInfo.parts;
    const subAssemblies: any[] = assemblyInfo.subAssemblies;
    let partCounter = 0;
    let subAssemblyCounter = 0;

    for (const instance of rootAssembly.instances) {
        const path = [instance.id as string];
        if (instance.type === "Part") {
            const part = parts[partCounter++];
            const mateConnectors: any[] = part.mateConnectors ?? [];
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
export async function parseFastenInfo(
    onshapeApi: any,
    elementPath: ElementPath,
    elementType: ElementType
): Promise<FastenInfo> {
    if (elementType === ElementType.PART_STUDIO) {
        const featureList = await getFeatures(onshapeApi, elementPath);
        return parseFastenInfoFromPartStudio(featureList);
    } else {
        const assemblyInfo = await getAssembly(onshapeApi, elementPath, {
            includeMateConnectors: true,
            includeMateFeatures: true
        });
        return parseFastenInfoFromAssembly(assemblyInfo);
    }
}

export enum MateLocation {
    Feature = "Feature",
    Part = "Part",
    Subassembly = "Subassembly"
}

export interface FastenInfo {
    mateConnectorId: string;
    mateLocation: MateLocation;
    path: string[];
}
