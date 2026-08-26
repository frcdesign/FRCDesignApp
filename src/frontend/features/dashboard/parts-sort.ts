import type { PartUsageOut } from "@backend/features/analytics/contract";

export type SortColumn =
    | "name"
    | "groupName"
    | "insertCount"
    | "lastInsertedAt";

export interface SortState {
    column: SortColumn;
    descending: boolean;
}

/** Most used first, which is what the table is usually read for. */
export const DEFAULT_SORT: SortState = {
    column: "insertCount",
    descending: true
};

/** Whether a column reads better with its largest value first. */
const DESCENDING_FIRST: Record<SortColumn, boolean> = {
    name: false,
    groupName: false,
    insertCount: true,
    lastInsertedAt: true
};

/** Clicking a column sorts by it, then flips direction on each further click. */
export function nextSort(prev: SortState, column: SortColumn): SortState {
    return prev.column === column
        ? { column, descending: !prev.descending }
        : { column, descending: DESCENDING_FIRST[column] };
}

function compare(a: PartUsageOut, b: PartUsageOut, column: SortColumn): number {
    switch (column) {
        case "name":
            return a.name.localeCompare(b.name);
        case "groupName":
            return a.groupName.localeCompare(b.groupName);
        case "insertCount":
            return a.insertCount - b.insertCount;
        case "lastInsertedAt":
            // Never-used parts sort as the oldest rather than jumping the list.
            return (a.lastInsertedAt ?? 0) - (b.lastInsertedAt ?? 0);
    }
}

/** Matches a part on its own name or its group's. */
export function matchesSearch(part: PartUsageOut, search: string): boolean {
    const term = search.trim().toLowerCase();
    if (term === "") return true;
    return (
        part.name.toLowerCase().includes(term) ||
        part.groupName.toLowerCase().includes(term)
    );
}

export function filterAndSort(
    parts: PartUsageOut[],
    search: string,
    sort: SortState
): PartUsageOut[] {
    return (
        parts
            .filter((part) => matchesSearch(part, search))
            // Ties break on name so the order never depends on how rows arrived.
            .sort(
                (a, b) =>
                    (sort.descending ? -1 : 1) * compare(a, b, sort.column) ||
                    a.name.localeCompare(b.name)
            )
    );
}
