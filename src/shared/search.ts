/**
 * Shared search-index definitions used by both the backend (which builds the
 * index when a document is loaded) and the frontend (which deserializes it with
 * the same options to run queries).
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "./api-models";
import { Vendor } from "./types";

const deliminator = "^";

/**
 * Adds spaces to a given string so prefix matching is more efficient.
 */
export function processTerm(term: string): string[] {
    // Split between lowercase-to-uppercase (camelCase -> camel case)
    const camelSplit = term
        .replace(/([a-z])([A-Z])/g, `$1${deliminator}$2`)
        .split(deliminator);

    // Insert spaces to handle MAXTube->MAX Tube, VEXpro->VEX pro
    const pascalSplit = term
        .replace(/([A-Z])([A-Z][a-z])/g, `$1${deliminator}$2`)
        .split(deliminator);

    const base = term.toLowerCase();

    const terms = [...camelSplit, ...pascalSplit, base].map((t) =>
        t.toLowerCase()
    );
    // Deduplicate
    return Array.from(new Set(terms));
}

export function tokenize(text: string): string[] {
    // Don't lowercase so we can use casing for term splitting
    // Remove -, (, ), ", ', #, &, /, and whitespace
    return text.split(/[-()"'#&\s^/]+/).filter(Boolean);
}

export interface SearchDocument {
    id: string;
    groupId: string;
    isVisible: boolean;
    vendors: Vendor[];
    name: string;
    groupName: string;
    favoriteName?: string;
    favoriteId?: string;
}

export const SEARCH_OPTIONS: Options<SearchDocument> = {
    fields: ["name", "groupName", "favoriteName"],
    storeFields: [
        "id",
        "groupId",
        "isVisible",
        "vendors",
        "name",
        "groupName",
        "favoriteName",
        "FavoriteId"
    ],
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
