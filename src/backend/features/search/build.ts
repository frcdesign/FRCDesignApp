/**
 * Builds the index a library is served as. Worker-side: it reads the whole
 * library, which the client never holds.
 */
import MiniSearch from "minisearch";
import { LibraryOut } from "../library/contract";
import { type SearchRecord } from "../configurations/contract";
import { SEARCH_OPTIONS, type SearchDocument } from "./contract";
import { distinctRecords } from "./records";

/** Joins the distinct non-null values with spaces (a searchable field's form). */
function uniqueJoin(values: (string | undefined)[]): string {
    return Array.from(
        new Set(values.filter((value): value is string => !!value))
    ).join(" ");
}

export function buildSearchDb(
    libraryData: LibraryOut,
    /** Each insertable's records, by id; see `searchRecordsOf`. */
    searchRecords: Record<string, SearchRecord[]> = {}
): MiniSearch<SearchDocument> {
    const searchDb = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);

    const searchDocuments: SearchDocument[] = Object.values(
        libraryData.insertables
    )
        .filter((element) => !!element)
        .map((element) => {
            const parentGroup = libraryData.groups[element.groupId];
            const records = distinctRecords(searchRecords[element.id] ?? []);
            return {
                id: element.id,
                groupId: element.groupId,
                isVisible: element.isVisible,
                vendors: element.vendors,
                name: element.name,
                groupName: parentGroup.name,
                partNumbers: uniqueJoin(
                    records.map((record) => record.partNumber)
                ),
                partNames: uniqueJoin(records.map((record) => record.name)),
                records
            };
        });

    searchDb.addAll(searchDocuments);
    return searchDb;
}
