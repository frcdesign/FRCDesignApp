import type { PartUsageOut } from "@backend/features/analytics/contract";

/**
 * One tile. Area is insertions, so a group's share of the library is its share
 * of the rectangle.
 *
 * `groupName` and `elementId` ride along to the click handler, which is how a
 * tile knows what it stands for.
 */
export interface TreemapNode {
    name: string;
    value: number;
    color: string;
    /** On a group tile; drilling down filters on it. */
    groupName?: string;
    /** On a part tile; clicking opens this part's dashboard. */
    elementId?: string;
}

/**
 * Shades by rank off the library's own hue, darkest first.
 *
 * Monotone rather than cycling: a lighter tile always means a smaller one, so
 * color reinforces area instead of contradicting it. Ranks past the ramp all
 * take the lightest shade, which by then are slivers anyway, and the stroke
 * between tiles keeps them apart.
 */
const SHADES = [9, 8, 7, 6, 5, 4, 3];

function shade(color: string, rank: number): string {
    const step = SHADES[Math.min(rank, SHADES.length - 1)];
    return `var(--mantine-color-${color}-${step})`;
}

/**
 * A part with no uses in the window is dropped rather than drawn: a zero-value
 * tile has no area but still sits in the DOM catching clicks.
 */
function used(parts: PartUsageOut[]): PartUsageOut[] {
    return parts.filter((part) => part.insertCount > 0);
}

/** Every group with at least one insertion, largest first. */
export function toGroupNodes(
    parts: PartUsageOut[],
    color: string
): TreemapNode[] {
    const totals = new Map<string, number>();
    for (const part of used(parts)) {
        totals.set(
            part.groupName,
            (totals.get(part.groupName) ?? 0) + part.insertCount
        );
    }

    return [...totals.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([groupName, value], rank) => ({
            name: groupName,
            value,
            color: shade(color, rank),
            groupName
        }));
}

/** The parts of one group, largest first; empty when the group is gone. */
export function toPartNodes(
    parts: PartUsageOut[],
    groupName: string,
    color: string
): TreemapNode[] {
    return used(parts)
        .filter((part) => part.groupName === groupName)
        .sort((a, b) => b.insertCount - a.insertCount)
        .map((part, rank) => ({
            name: part.name,
            value: part.insertCount,
            color: shade(color, rank),
            elementId: part.elementId
        }));
}
