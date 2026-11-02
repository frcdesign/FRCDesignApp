import MiniSearch from "minisearch";
import type { InsertableOut } from "@backend/features/library/contract";
import type { SearchRecord } from "@backend/features/configurations/contract";
import {
    SEARCH_OPTIONS,
    type SearchDocument
} from "@backend/features/search/contract";
import { doSearch, type SearchHit } from "./search";

/** One row of a list someone keeps, such as favorites, in the configuration it opens on. */
export interface ListRow {
    id: string;
    insertable: InsertableOut;
    groupName: string;
    /** The row's own configuration's part, whose number it is searched by. */
    record?: SearchRecord;
}

export interface ListHit<T extends ListRow> {
    row: T;
    hit: SearchHit;
}

/**
 * Searches a list's own rows as the library is searched, each by its own
 * configuration's part number, so another configuration's never pulls one up.
 * Ranked; visibility and vendors are left to the list.
 */
export function searchList<T extends ListRow>(
    rows: T[],
    query: string
): ListHit<T>[] {
    const searchDb = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);
    searchDb.addAll(
        rows.map((row) => ({
            id: row.id,
            groupId: row.insertable.groupId,
            isVisible: row.insertable.isVisible,
            vendors: row.insertable.vendors,
            name: row.insertable.name,
            groupName: row.groupName,
            partNumbers: row.record?.partNumber ?? "",
            records: row.record ? [row.record] : []
        }))
    );
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    return doSearch({ searchDb, query, showHidden: true }).hits.flatMap(
        (hit) => {
            const row = rowsById.get(hit.id);
            return row ? [{ row, hit }] : [];
        }
    );
}
