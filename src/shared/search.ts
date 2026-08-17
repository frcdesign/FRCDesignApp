/**
 * Shared search-index definitions used by both the backend (which builds the
 * index when a document is loaded) and the frontend (which deserializes it with
 * the same options to run queries).
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "./api-models";
import { Vendor } from "./types";
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
 * Rewrites numbers and fractions to one 2-dp decimal, so `.5`, `1/2`, and `0.50`
 * all become `"0.5"`. Applied at index and query time alike, which is what lets
 * the raw fragments go unstored. Thread specs like `10-32` are left alone.
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
 * Canonicalizes a string for direct (non-tokenized) comparison — same number
 * canonicalization as the index, lowercased — so exact/prefix/substring checks
 * against a stored part number or name agree with what the index matched (e.g. a
 * `.5` query lines up with a stored `"1/2 Bearing"`).
 */
export function normalizeForMatch(text: string): string {
    return canonicalizeNumbers(text).toLowerCase();
}

export function tokenize(text: string): string[] {
    // Canonicalize fractions/decimals before splitting (they span `/` and `-`,
    // which the split would otherwise break apart). Don't lowercase — casing is
    // needed by processTerm's camelCase splitting.
    // Remove -, (, ), ", ', #, &, /, and whitespace
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
    // One entry per distinct (part number, name) the insertable produces, in
    // enumeration order. Stored, not indexed — used to pick the best-matching
    // configuration for a hit and to launch it in the insert menu.
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
 * Distills an insertable's records to the slice search needs, in enumeration
 * order (default-first, latest-option-first), keeping the first occurrence of
 * each distinct (part number, name) pair and dropping records with neither.
 * First-wins keeps the latest revision, as {@link ConfigurationRecord} ordering
 * intends.
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
