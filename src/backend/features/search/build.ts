/**
 * Builds the index a library is served as. Worker-side: it reads the library and
 * the vendor url table, neither of which the client needs to hold.
 */
import MiniSearch from "minisearch";
import { LibraryOut } from "../library/contract";
import { Vendor } from "../library/vendors";
import { ConfigurationRecord, SearchRecord } from "../configurations/contract";
import { getPartUrl } from "../configurations/utils";
import { meaningfulPartNumber } from "../configurations/part-number";
import { clean } from "../../lib/text";
import { SEARCH_OPTIONS, type SearchDocument } from "./contract";

/** Joins the distinct non-null values with spaces (a searchable field's form). */
function uniqueJoin(values: (string | undefined)[]): string {
    return Array.from(
        new Set(values.filter((value): value is string => !!value))
    ).join(" ");
}

/**
 * First of each distinct (part number, name) in enumeration order, which keeps
 * the latest revision. One identifying nothing is dropped before the index sees it.
 */
export function toSearchRecords(
    records: ConfigurationRecord[],
    vendors: Vendor[] = []
): SearchRecord[] {
    const seen = new Set<string>();
    const searchRecords: SearchRecord[] = [];
    for (const raw of records) {
        const partNumber = meaningfulPartNumber(raw.partNumber, raw.name);
        const name = clean(raw.name);
        if (!partNumber && !name) {
            continue;
        }
        const key = JSON.stringify([partNumber, name]);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        searchRecords.push({
            partNumber,
            name,
            url: getPartUrl({ ...raw, partNumber }, vendors),
            configurationKey: raw.configurationKey
        });
    }
    return searchRecords;
}

export function buildSearchDb(
    libraryData: LibraryOut,
    recordsMap: Record<string, ConfigurationRecord[]> = {}
): MiniSearch<SearchDocument> {
    const searchDb = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);

    const searchDocuments: SearchDocument[] = Object.values(
        libraryData.insertables
    )
        .filter((element) => !!element)
        .map((element) => {
            const parentGroup = libraryData.groups[element.groupId];
            const records = toSearchRecords(
                recordsMap[element.id] ?? [],
                element.vendors
            );
            return {
                id: element.id,
                groupId: element.groupId,
                isVisible: element.isVisible,
                vendors: element.vendors,
                name: element.name,
                groupName: parentGroup.name,
                partNumbers: uniqueJoin(records.map((r) => r.partNumber)),
                partNames: uniqueJoin(records.map((r) => r.name)),
                records
            };
        });

    searchDb.addAll(searchDocuments);
    return searchDb;
}
