import type { PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { getLibraryColor } from "../../theme";
import { colorVar, FILLED_SHADE } from "../../lib/style-constants";

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

/** What a tile stands for, and so what clicking it does. */
export enum TreemapKind {
    LIBRARY = "library",
    GROUP = "group",
    PART = "part"
}

/** What every tile carries; its area is its fraction of the parent's uses. */
interface TileBase {
    name: string;
    value: number;
    color: string;
}

/**
 * One tile. Discriminated rather than a bag of optional ids, so a click reads
 * the level it is on instead of guessing from which keys are set.
 */
export type TreemapNode =
    | (TileBase & { kind: TreemapKind.LIBRARY; libraryId: LibraryId })
    | (TileBase & { kind: TreemapKind.GROUP; groupName: string })
    | (TileBase & {
          kind: TreemapKind.PART;
          libraryId: LibraryId;
          elementId: string;
      });

/**
 * Shades by rank off one hue, darkest first: monotone rather than cycling, so a
 * lighter tile always means a smaller one.
 */
const SHADES = [9, 8, 7, 6, 5, 4, 3];

function shade(color: string, rank: number): string {
    return colorVar(color, SHADES[Math.min(rank, SHADES.length - 1)]);
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

/** Insertions summed by a key, largest first — so an index is a shade rank. */
function totalsBy<K extends string>(
    parts: UsagePart[],
    keyOf: (part: UsagePart) => K
): { key: K; value: number }[] {
    const totals = new Map<K, number>();
    for (const part of parts) {
        const key = keyOf(part);
        totals.set(key, (totals.get(key) ?? 0) + part.insertCount);
    }
    return [...totals]
        .sort(([, a], [, b]) => b - a)
        .map(([key, value]) => ({ key, value }));
}

/**
 * The tiles at `path`. Libraries keep the colors the charts give them, and
 * everything inside one shades off that library's hue.
 */
export function toNodes(parts: UsagePart[], path: TreemapPath): TreemapNode[] {
    const shown = within(parts, path);

    if (path.libraryId === undefined) {
        return totalsBy(shown, (part) => part.libraryId).map(
            ({ key, value }) => ({
                kind: TreemapKind.LIBRARY,
                name: getLibraryName(key),
                value,
                color: colorVar(getLibraryColor(key), FILLED_SHADE),
                libraryId: key
            })
        );
    }

    const hue = getLibraryColor(path.libraryId);

    if (path.groupName === undefined) {
        return totalsBy(shown, (part) => part.groupName).map(
            ({ key, value }, rank) => ({
                kind: TreemapKind.GROUP,
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
            kind: TreemapKind.PART,
            name: part.name,
            value: part.insertCount,
            color: shade(hue, rank),
            libraryId: part.libraryId,
            elementId: part.path.elementId
        }));
}
