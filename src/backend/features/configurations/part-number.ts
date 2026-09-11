import { clean, equalsIgnoreCase } from "../../lib/text";

/** Admins write this in where a generic part has no real number to give. */
const PLACEHOLDER_PART_NUMBER = new RegExp("^n/a$", "i");

/** Whether text is the placeholder, which identifies nothing anywhere. */
export function isPlaceholderPartNumber(text: string): boolean {
    return PLACEHOLDER_PART_NUMBER.test(text.trim());
}

/**
 * The part number when it identifies the part, and nothing when it repeats the
 * name or holds a placeholder. One rule, so an unsearchable number is never shown.
 */
export function meaningfulPartNumber(
    partNumber: string | undefined | null,
    name?: string | null
): string | undefined {
    const text = clean(partNumber);
    if (!text || isPlaceholderPartNumber(text)) {
        return undefined;
    }
    return equalsIgnoreCase(text, name) ? undefined : text;
}
