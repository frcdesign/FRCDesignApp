import type { ZodType } from "zod";

/** Omits what fails, since `retainSearchParams` reads an undefined key as cleared. */
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
