/**
 * Extracts the part number Onshape reports for an element from its raw API
 * response. Kept separate from the fetching in `onshape-api/endpoints/parts.ts`
 * so the extraction rules are pure and directly testable.
 *
 * Part numbers become search terms and the keys of a `PartNumberMap`, so a
 * value is normalized (trimmed) and a blank one is treated as unset.
 */
import type {
    OnshapeAssemblyDefinition,
    OnshapePart
} from "../onshape-api/onshape-types";

/**
 * Normalizes a raw part-number property: trims surrounding whitespace and maps
 * a missing or blank value to `null`.
 */
export function normalizePartNumber(
    partNumber: string | undefined | null
): string | null {
    const trimmed = partNumber?.trim();
    return trimmed ? trimmed : null;
}

/**
 * Returns the part number of a part studio's part, or `null` if none is set.
 * An indexed part studio resolves to a single part, so the first part carrying
 * a part number is the one we want.
 */
export function parsePartStudioPartNumber(parts: OnshapePart[]): string | null {
    if (!Array.isArray(parts)) {
        return null;
    }
    for (const part of parts) {
        const partNumber = normalizePartNumber(part?.partNumber);
        if (partNumber) {
            return partNumber;
        }
    }
    return null;
}

/**
 * Returns the root assembly's part number, or `null` if none is set.
 */
export function parseAssemblyPartNumber(
    definition: OnshapeAssemblyDefinition | undefined | null
): string | null {
    return normalizePartNumber(definition?.rootAssembly?.partNumber);
}
