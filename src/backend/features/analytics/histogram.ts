/** Distributions the dashboards draw: a leaf, so the frontend labels bins as they were cut. */

export interface HistogramBin {
    /** Inclusive. */
    from: number;
    /** Exclusive. */
    to: number;
    count: number;
}

export interface Histogram {
    bins: HistogramBin[];
    /** Counts of whole things, so a bin reads "2–4" rather than "2–5". */
    integer: boolean;
}

/**
 * Edges at 0, 1, 2, 5, 10, 20, 50, ... up past `max`: usage is long-tailed, so
 * equal widths would put nearly everybody in the first bin.
 */
export function niceEdges(max: number): number[] {
    const edges = [0, 1];
    for (let decade = 1; edges[edges.length - 1] <= max; decade *= 10) {
        for (const step of [2, 5, 10]) {
            edges.push(step * decade);
            if (edges[edges.length - 1] > max) break;
        }
    }
    return edges;
}

export function toHistogram(values: number[], integer: boolean): Histogram {
    const edges = niceEdges(Math.max(0, ...values));
    const bins = edges.slice(0, -1).map((from, index) => ({
        from,
        to: edges[index + 1],
        count: 0
    }));
    for (const value of values) {
        const bin = binOf(bins, value);
        if (bin !== undefined) bins[bin].count++;
    }
    // Nobody below the smallest value: uses per person start at one.
    const first = bins.findIndex((bin) => bin.count > 0);
    return { bins: first < 0 ? bins : bins.slice(first), integer };
}

/** The bin a value falls in; undefined below zero. */
export function binOf(bins: HistogramBin[], value: number): number | undefined {
    const index = bins.findIndex((bin) => value >= bin.from && value < bin.to);
    return index < 0 ? undefined : index;
}
