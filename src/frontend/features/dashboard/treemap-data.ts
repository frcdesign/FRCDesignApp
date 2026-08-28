import type { GroupUsageOut } from "@backend/features/analytics/contract";

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

/** Every group with at least one insertion, largest first. */
export function toGroupNodes(
    groups: GroupUsageOut[],
    color: string
): TreemapNode[] {
    return groups.map((entry, rank) => ({
        name: entry.groupName,
        value: entry.insertCount,
        color: shade(color, rank),
        groupName: entry.groupName
    }));
}

/** The parts of one group, largest first; empty when the group is gone. */
export function toPartNodes(
    groups: GroupUsageOut[],
    groupName: string,
    color: string
): TreemapNode[] {
    const entry = groups.find((candidate) => candidate.groupName === groupName);
    return (entry?.parts ?? []).map((part, rank) => ({
        name: part.name,
        value: part.insertCount,
        color: shade(color, rank),
        elementId: part.elementId
    }));
}
