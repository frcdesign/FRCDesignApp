import type { PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { getLibraryColor } from "../../theme";

/** A part tagged with the library it came from, so one list spans them all. */
export interface UsagePart extends PartUsageOut {
    libraryId: LibraryId;
}

/**
 * How far in the treemap is looking: every library, one library's groups, or
 * one group's parts. Parts are leaves — clicking one leaves the chart.
 */
export interface TreemapPath {
    libraryId?: LibraryId;
    groupName?: string;
}

/**
 * One tile, its area a share of its parent's insertions. The optional keys say
 * what a click does: descend a level, or open a part's dashboard.
 */
export interface TreemapNode {
    name: string;
    value: number;
    color: string;
    libraryId?: LibraryId;
    groupName?: string;
    elementId?: string;
}

/**
 * Shades by rank off one hue, darkest first: monotone rather than cycling, so a
 * lighter tile always means a smaller one.
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
function within(parts: UsagePart[], path: TreemapPath): UsagePart[] {
    return parts.filter(
        (part) =>
            part.insertCount > 0 &&
            (path.libraryId === undefined ||
                part.libraryId === path.libraryId) &&
            (path.groupName === undefined || part.groupName === path.groupName)
    );
}

/** Sums `parts` by a key, largest first, then colors by rank. */
function rollUp(
    parts: UsagePart[],
    keyOf: (part: UsagePart) => string,
    toNode: (key: string, value: number, rank: number) => TreemapNode
): TreemapNode[] {
    const totals = new Map<string, number>();
    for (const part of parts) {
        const key = keyOf(part);
        totals.set(key, (totals.get(key) ?? 0) + part.insertCount);
    }
    return [...totals.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([key, value], rank) => toNode(key, value, rank));
}

/**
 * The tiles at `path`. Libraries keep the colors the charts give them, and
 * everything inside one shades off that library's hue.
 */
export function toNodes(parts: UsagePart[], path: TreemapPath): TreemapNode[] {
    const shown = within(parts, path);

    if (path.libraryId === undefined) {
        return rollUp(
            shown,
            (part) => part.libraryId,
            (key, value) => ({
                name: getLibraryName(key),
                value,
                color: `var(--mantine-color-${getLibraryColor(key)}-6)`,
                libraryId: key as LibraryId
            })
        );
    }

    const hue = getLibraryColor(path.libraryId);

    if (path.groupName === undefined) {
        return rollUp(
            shown,
            (part) => part.groupName,
            (key, value, rank) => ({
                name: key,
                value,
                color: shade(hue, rank),
                groupName: key
            })
        );
    }

    return shown
        .sort((a, b) => b.insertCount - a.insertCount)
        .map((part, rank) => ({
            name: part.name,
            value: part.insertCount,
            color: shade(hue, rank),
            elementId: part.elementId,
            libraryId: part.libraryId
        }));
}
