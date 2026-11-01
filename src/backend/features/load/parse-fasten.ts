import { ElementType } from "../../lib/onshape/element-type";
import { FastenInfo, MateLocation } from "../library/insertables/fasten";
import { type ElementPath } from "../../lib/onshape/path";
import { getAssembly } from "../../lib/onshape/endpoints/assemblies";
import { getFeatures } from "../../lib/onshape/endpoints/part-studios";
import { type BuildIssue, BuildIssueType } from "../build-checker/issues";

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

/** What the load stores about fastening, and the issues it raises. */
export interface FastenResult {
    supportsFasten: boolean;
    /** The connector found, kept even when fastening is off so the card can offer it. */
    fastenInfo: FastenInfo | null;
    buildIssues: BuildIssue[];
}

/** The types a fasten decision raises, which `replaceBuildIssues` clears first. */
export const FASTEN_ISSUE_TYPES = [
    BuildIssueType.NO_MATE_CONNECTOR,
    BuildIssueType.UNSTABLE_MATE_CONNECTOR
];

/**
 * A part studio is always looked at, since that is how its default is decided.
 * An assembly's definition is far larger, so it is read only when an admin turned
 * fastening on.
 */
export function shouldFindMateConnector(
    elementType: ElementType,
    fastenOverride: boolean | undefined
): boolean {
    return fastensByDefault(elementType) || fastenOverride === true;
}

/** Left to itself, a part studio with a connector fastens and an assembly doesn't. */
function fastensByDefault(elementType: ElementType): boolean {
    return elementType === ElementType.PART_STUDIO;
}

export async function findMateConnector(
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType
): Promise<MateConnector | undefined> {
    if (elementType === ElementType.PART_STUDIO) {
        return findPartStudioMateConnector(
            await getFeatures(onshapeApi, elementPath)
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

/** The admin's choice wins; left to itself, a part studio with a connector fastens. */
export function decideFasten(
    elementType: ElementType,
    fastenOverride: boolean | undefined,
    found: MateConnector | undefined
): FastenResult {
    const fastenInfo = found?.fastenInfo ?? null;
    const wanted = fastenOverride ?? fastensByDefault(elementType);
    if (!wanted) {
        return { supportsFasten: false, fastenInfo, buildIssues: [] };
    }
    if (!found) {
        return {
            supportsFasten: false,
            fastenInfo,
            buildIssues:
                fastenOverride === true
                    ? [{ type: BuildIssueType.NO_MATE_CONNECTOR }]
                    : []
        };
    }
    return {
        supportsFasten: true,
        fastenInfo,
        buildIssues: found.isUnstable
            ? [{ type: BuildIssueType.UNSTABLE_MATE_CONNECTOR }]
            : []
    };
}

/**
 * The override to store for what an admin switched to: none where it matches
 * what detection decides, so a part studio switched back follows its connectors.
 */
export function toFastenOverride(
    elementType: ElementType,
    supportsFasten: boolean,
    found: MateConnector | undefined
): boolean | undefined {
    const automatic = decideFasten(elementType, undefined, found);
    return supportsFasten === automatic.supportsFasten
        ? undefined
        : supportsFasten;
}

/**
 * The first mate connector the default configuration regenerates. It is unstable
 * when a configuration decides its suppression, or that of one before it, since
 * either changes which connector comes first.
 */
export function findPartStudioMateConnector(
    response: OnshapeFeatureListResponse
): MateConnector | undefined {
    // One suppressed outright is off in every configuration, so it never counts.
    const candidates = response.features.filter(
        (feature) =>
            feature.featureType === "mateConnector" &&
            (!feature.suppressed || feature.suppressionConfigured === true)
    );
    const index = candidates.findIndex((feature) => !feature.suppressed);
    if (index === -1) {
        return undefined;
    }
    const first = candidates[index];
    const status = response.featureStates?.[first.featureId]?.featureStatus;
    return {
        fastenInfo: {
            mateConnectorId: first.featureId,
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
