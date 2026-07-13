/**
 * Shared search-index definitions used by both the backend (which builds the
 * index when a document is loaded) and the frontend (which deserializes it with
 * the same options to run queries).
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "./api-models";
import { Vendor } from "./types";
import { processTerm, tokenize } from "./search-utils";

export interface SearchDocument {
    id: string;
    groupId: string;
    isVisible: boolean;
    vendors: Vendor[];
    name: string;
    groupName: string;
}

export const SEARCH_OPTIONS: Options<SearchDocument> = {
    fields: ["name", "groupName"],
    storeFields: ["id", "groupId", "isVisible", "vendors", "name", "groupName"],
    searchOptions: {
        boost: { groupName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize,
    processTerm
};

export function buildSearchDb(
    libraryData: LibraryOut
): MiniSearch<SearchDocument> {
    const searchDb = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);

    const searchDocuments: SearchDocument[] = Object.values(
        libraryData.insertables
    )
        .filter((element) => !!element)
        .map((element) => {
            const parentGroup = libraryData.groups[element.groupId];
            return {
                id: element.id,
                groupId: element.groupId,
                isVisible: element.isVisible,
                vendors: element.vendors,
                name: element.name,
                groupName: parentGroup.name
            };
        });

    searchDb.addAll(searchDocuments);
    return searchDb;
}
