import type { PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { getLibraryColor } from "../../theme";

/** A part tagged with the library it came from, so one list spans them all. */
export interface UsagePart extends PartUsageOut {
    libraryId: LibraryId;
}

/**
 * How far into the hierarchy the treemap is looking.
 *
 * An empty path is every library; naming a library shows its groups; naming a
 * group shows its parts. Parts are leaves — clicking one leaves the chart.
 */
export interface TreemapPath {
    libraryId?: LibraryId;
    groupName?: string;
}

/**
 * One tile. Area is insertions, so a slice's share of its parent is its share
 * of the rectangle.
 *
 * The optional keys say what a click does: descend to a library, descend to a
 * group, or open a part's dashboard.
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
 * Shades by rank off one hue, darkest first.
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
 * The tiles at `path`.
 *
 * Libraries keep their own colors, the same ones the charts use for them;
 * inside a library everything shades off that library's hue, so the level you
 * are in is legible from the palette alone.
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
