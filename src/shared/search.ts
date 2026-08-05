/**
 * Shared search-index definitions used by both the backend (which builds the
 * index when a document is loaded) and the frontend (which deserializes it with
 * the same options to run queries).
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "./api-models";
import { Vendor } from "./types";
import { ConfigurationRecord, ParameterValues } from "./configuration-models";

const deliminator = "^";

/**
 * Part number -> the (canonical) configuration that produces it. Derived from an
 * insertable's `ConfigurationRecord[]` at index-build time: many configurations
 * can share a part number, so this collapses them first-wins — and records come
 * in enumeration order (latest option first), so search launches the latest.
 */
export type PartNumberMap = Record<string, ParameterValues>;

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
    // Space-joined part numbers (the searchable field); empty when the
    // insertable has no indexed part numbers.
    partNumbers: string;
    // Part number -> the configuration that produces it, used to launch the
    // matched configuration. Stored, not indexed.
    partNumberConfigs: PartNumberMap;
}

export const SEARCH_OPTIONS: Options<SearchDocument> = {
    fields: ["name", "groupName", "partNumbers"],
    storeFields: [
        "id",
        "groupId",
        "isVisible",
        "vendors",
        "name",
        "groupName",
        "partNumberConfigs"
    ],
    searchOptions: {
        boost: { groupName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize,
    processTerm
};

/**
 * Folds an insertable's records into the search map: part number -> the first
 * configuration that produces it. First-wins over enumeration order keeps the
 * latest option (see {@link PartNumberMap}).
 */
function toPartNumberMap(records: ConfigurationRecord[]): PartNumberMap {
    const partNumberConfigs: PartNumberMap = {};
    for (const record of records) {
        if (record.partNumber) {
            partNumberConfigs[record.partNumber] ??= record.configuration;
        }
    }
    return partNumberConfigs;
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
            const partNumberConfigs = toPartNumberMap(
                recordsMap[element.id] ?? []
            );
            return {
                id: element.id,
                groupId: element.groupId,
                isVisible: element.isVisible,
                vendors: element.vendors,
                name: element.name,
                groupName: parentGroup.name,
                partNumbers: Object.keys(partNumberConfigs).join(" "),
                partNumberConfigs
            };
        });

    searchDb.addAll(searchDocuments);
    return searchDb;
}
