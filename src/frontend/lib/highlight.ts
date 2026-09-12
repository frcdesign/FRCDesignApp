/** Where a query matched inside a string, and the arithmetic over those runs. */

/** A run of matched characters. Named for the highlight; `Range` is a DOM type. */
export interface Position {
    start: number;
    length: number;
}

/**
 * Overlapping runs merged into the fewest that cover the same characters, in
 * ascending order — walking an index map is what makes both true, and callers
 * render off the pair.
 */
export function mergePositions(positions: Position[]): Position[] {
    // Mapping where indexMap[i] = true means i is in a range.
    const indexMap: boolean[] = [];
    positions.forEach((position) => {
        for (let i = 0; i < position.length; i++) {
            indexMap[position.start + i] = true;
        }
    });

    const merged: Position[] = [];
    // indexMap.length will always include the highest index set
    for (let i = 0; i < indexMap.length; i++) {
        if (!indexMap[i]) {
            continue;
        }
        const start = i;
        while (i < indexMap.length && indexMap[i]) {
            i++;
        }
        merged.push({ start, length: i - start });
    }
    return merged;
}
