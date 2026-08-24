/** Turns a stored FastenInfo into the Onshape query an insert mates against. */
import { ElementType } from "../../../lib/onshape/element-type";
import {
    featureOccurrenceQuery,
    partStudioMateConnectorQuery
} from "../../../lib/onshape/objects/assembly-features";
import { FastenInfo, MateLocation } from "./fasten";

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
