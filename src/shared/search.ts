/**
 * Shared index definitions: the backend builds the index, the frontend
 * deserializes it with the same options.
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "./library-dto";
import { Vendor } from "./vendors";
import { ConfigurationRecord, SearchRecord } from "./configuration-models";

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

// A mixed number, simple fraction, or decimal (incl. leading-dot). Alternatives
// are ordered longest-first so `1-1/2` is consumed whole, not as `1` + `1/2`.
const NUMERIC_PATTERN = /(\d+)-(\d+)\/(\d+)|(\d+)\/(\d+)|\d*\.\d+|\d+\.\d*/g;

/**
 * Rewrites numbers and fractions to one 2-dp decimal, at index and query time
 * alike — which is what lets the raw fragments go unstored.
 */
function canonicalizeNumbers(text: string): string {
    return text.replace(
        NUMERIC_PATTERN,
        (match, mixedWhole, mixedNum, mixedDen, fracNum, fracDen) => {
            let value: number;
            if (mixedWhole !== undefined) {
                value =
                    Number(mixedWhole) + Number(mixedNum) / Number(mixedDen);
            } else if (fracNum !== undefined) {
                value = Number(fracNum) / Number(fracDen);
            } else {
                value = Number(match);
            }
            if (!Number.isFinite(value)) {
                return match;
            }
            return String(Math.round(value * 100) / 100);
        }
    );
}

/**
 * For direct, non-tokenized comparison: the index's number canonicalization,
 * lowercased, so a `.5` query lines up with a stored `"1/2 Bearing"`.
 */
export function normalizeForMatch(text: string): string {
    return canonicalizeNumbers(text).toLowerCase();
}

export function tokenize(text: string): string[] {
    // Canonicalize before splitting: fractions span `/` and `-`. Casing stays,
    // since processTerm splits on camelCase.
    return canonicalizeNumbers(text)
        .split(/[-()"'#&\s^/]+/)
        .filter(Boolean);
}

export interface SearchDocument {
    id: string;
    groupId: string;
    isVisible: boolean;
    vendors: Vendor[];
    name: string;
    groupName: string;
    // Space-joined, deduped part numbers (a searchable field); empty when the
    // insertable has no indexed part numbers.
    partNumbers: string;
    // Space-joined, deduped configuration (part) names (a searchable field);
    // empty when the insertable has no indexed records.
    partNames: string;
    // Stored, not indexed: picks the best-matching configuration for a hit and
    // launches it in the insert menu.
    records: SearchRecord[];
}

export const SEARCH_OPTIONS: Options<SearchDocument> = {
    fields: ["name", "groupName", "partNumbers", "partNames"],
    storeFields: [
        "id",
        "groupId",
        "isVisible",
        "vendors",
        "name",
        "groupName",
        "records"
    ],
    searchOptions: {
        // The insertable's own title leads; part names and the group name are
        // weaker signals, so a title match outranks them.
        boost: { partNames: 0.7, groupName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize,
    processTerm
};

/** Joins the distinct non-null values with spaces (a searchable field's form). */
function uniqueJoin(values: (string | null)[]): string {
    return Array.from(
        new Set(values.filter((value): value is string => !!value))
    ).join(" ");
}

/**
 * Keeps the first of each distinct (part number, name) in enumeration order and
 * drops records with neither. First-wins is what keeps the latest revision.
 */
export function toSearchRecords(
    records: ConfigurationRecord[]
): SearchRecord[] {
    const seen = new Set<string>();
    const searchRecords: SearchRecord[] = [];
    for (const record of records) {
        if (!record.partNumber && !record.name) {
            continue;
        }
        const key = JSON.stringify([record.partNumber, record.name]);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        searchRecords.push({
            partNumber: record.partNumber,
            name: record.name,
            configuration: record.configuration
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
            const records = toSearchRecords(recordsMap[element.id] ?? []);
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
