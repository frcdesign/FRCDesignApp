/**
 * D1 rejects a statement carrying more than 100 bound parameters, and drizzle's
 * `inArray` binds one per value. The ten left spare cover the rest of a
 * statement's conditions; the widest here pairs a library id with the list.
 */
const MAX_IN_ARRAY_VALUES = 90;

/**
 * Splits values into runs an `inArray` can carry in a single statement. An
 * empty list yields no chunks, which leaves a caller's loop doing nothing —
 * the same as the `false` drizzle builds for an empty `inArray`.
 */
export function chunkForInArray<T>(values: T[]): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < values.length; i += MAX_IN_ARRAY_VALUES) {
        chunks.push(values.slice(i, i + MAX_IN_ARRAY_VALUES));
    }
    return chunks;
}
