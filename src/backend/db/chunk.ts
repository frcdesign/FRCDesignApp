/** D1 allows 100 bound parameters per statement; the spare ten cover the other conditions. */
const MAX_IN_ARRAY_VALUES = 90;

/** Empty input yields no chunks. */
export function chunkForInArray<T>(values: T[]): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < values.length; i += MAX_IN_ARRAY_VALUES) {
        chunks.push(values.slice(i, i + MAX_IN_ARRAY_VALUES));
    }
    return chunks;
}
