import { ElementType } from "../../lib/onshape/element-type";
import { FastenInfo, MateLocation } from "../library/insertables/fasten";
import { type ElementPath } from "../../lib/onshape/path";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { getFeatures } from "../../lib/onshape/endpoints/part-studios";
import { type BuildIssue, BuildIssueType } from "../build-checker/issues";
import { type GeneratedFeature } from "../generated-parts/manifest";

import { OnshapeApi } from "../../lib/onshape/client";
import {
    OnshapeAssemblyDefinition,
    OnshapeAssemblyFeature,
    OnshapeFeatureListResponse
} from "../../lib/onshape/types";

/** The mate connector inserts would place and fasten at. */
export interface MateConnector {
    fastenInfo: FastenInfo;
    /** Some configuration may lose it or put another first, or it fails to regenerate. */
    isUnstable: boolean;
}

/** What a load or the switch stores: the connector inserts use, and its issues. */
export interface FastenResult {
    /** Null when there is no connector, or an admin turned fastening off. */
    fastenInfo: FastenInfo | null;
    buildIssues: BuildIssue[];
}

/** The types a fasten decision raises, which `replaceBuildIssues` clears first. */
export const FASTEN_ISSUE_TYPES = [BuildIssueType.UNSTABLE_MATE_CONNECTOR];

/** Inserts fasten and place at the connector found, if there is one. */
export function decideFasten(found: MateConnector | undefined): FastenResult {
    if (!found) {
        return { fastenInfo: null, buildIssues: [] };
    }
    return {
        fastenInfo: found.fastenInfo,
        buildIssues: found.isUnstable
            ? [{ type: BuildIssueType.UNSTABLE_MATE_CONNECTOR }]
            : []
    };
}

/** `generatedFeatures`: every loaded generated set's studio features (`generatedFeatures`). */
export async function findMateConnector(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    generatedFeatures: GeneratedFeature[] = []
): Promise<MateConnector | undefined> {
    if (elementType === ElementType.PART_STUDIO) {
        return findPartStudioMateConnector(
            await getFeatures(onshapeApi, elementPath),
            generatedFeatures
        );
    }
    const fastenInfo = findAssemblyMateConnector(
        await getAssembly(onshapeApi, elementPath, {
            includeMateConnectors: true,
            includeMateFeatures: true
        })
    );
    return fastenInfo && { fastenInfo, isUnstable: false };
}

/**
 * The first mate connector the default configuration regenerates: Onshape's
 * own, named by its id, or a generated studio's feature's, named
 * `<featureId>.<mateConnector>` as a fasten mate names what a feature made. It
 * is unstable when a configuration decides its suppression, or that of one
 * before it, since either changes which connector comes first.
 */
export function findPartStudioMateConnector(
    response: OnshapeFeatureListResponse,
    generatedFeatures: GeneratedFeature[] = []
): MateConnector | undefined {
    const subIds = new Map(
        generatedFeatures.flatMap((feature) =>
            feature.mateConnector ? [[feature.type, feature.mateConnector]] : []
        )
    );
    // One suppressed outright is off in every configuration, so it never counts.
    const candidates = response.features.filter(
        (feature) =>
            (feature.featureType === "mateConnector" ||
                subIds.has(feature.featureType)) &&
            (!feature.suppressed || feature.suppressionConfigured === true)
    );
    const index = candidates.findIndex((feature) => !feature.suppressed);
    if (index === -1) {
        return undefined;
    }
    const first = candidates[index];
    const status = response.featureStates?.[first.featureId]?.featureStatus;
    const subId = subIds.get(first.featureType);
    return {
        fastenInfo: {
            mateConnectorId: subId
                ? `${first.featureId}.${subId}`
                : first.featureId,
            mateLocation: MateLocation.Feature,
            path: []
        },
        isUnstable:
            status === "ERROR" ||
            candidates
                .slice(0, index + 1)
                .some((feature) => feature.suppressionConfigured === true)
    };
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

export function findAssemblyMateConnector(
    rawAssemblyInfo: OnshapeAssemblyDefinition
): FastenInfo | undefined {
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
    return undefined;
}
