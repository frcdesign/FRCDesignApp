/** Trimming and casing, defined once: both sides import this leaf. */

/** A value's meaningful text, or nothing when it is blank. */
export function clean(text: string | undefined | null): string | undefined {
    return text?.trim() || undefined;
}

/** Whether two values say the same thing, ignoring case and surrounding space. */
export function equalsIgnoreCase(
    a: string | undefined | null,
    b: string | undefined | null
): boolean {
    return clean(a)?.toLowerCase() === clean(b)?.toLowerCase();
}
