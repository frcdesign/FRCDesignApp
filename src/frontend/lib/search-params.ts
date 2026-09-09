import type { ZodType } from "zod";

/**
 * Validates url search params, dropping whatever doesn't fit the schema.
 *
 * A rejected key is omitted rather than left as undefined: `retainSearchParams`
 * tests `key in search`, so an undefined value reads as "cleared" and stops the
 * param carrying across navigations.
 */
export function parseSearch<T extends object>(
    schema: ZodType<T>,
    search: unknown
): T {
    const parsed = schema.parse(search) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) {
        if (parsed[key] === undefined) {
            delete parsed[key];
        }
    }
    return parsed as T;
}
