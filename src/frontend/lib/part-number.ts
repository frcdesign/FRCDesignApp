/** Admins write this in where a generic part has no real number to give. */
const PLACEHOLDER_PART_NUMBER = /^n\/a$/i;

/**
 * The part number to show, or nothing when it identifies nothing — a
 * placeholder, or a repeat of the name it sits under.
 */
export function displayPartNumber(
    partNumber: string | undefined,
    name?: string
): string | undefined {
    const text = partNumber?.trim();
    if (!text || PLACEHOLDER_PART_NUMBER.test(text)) {
        return undefined;
    }
    return text.toLowerCase() === name?.trim().toLowerCase() ? undefined : text;
}
