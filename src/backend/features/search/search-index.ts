/**
 * Shared index definitions: the backend builds the index, the frontend
 * deserializes it with the same options.
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "../library/contract";
import { Vendor } from "../library/vendors";
import { ConfigurationRecord, SearchRecord } from "../configurations/models";
import { getPartUrl } from "../configurations/utils";

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

// A mixed number, simple fraction, decimal (incl. leading-dot), or plain
// integer. Alternatives are ordered longest-first so `1-1/2` is consumed whole,
// not as `1` + `1/2`.
const NUMERIC_PATTERN =
    /(\d+)-(\d+)\/(\d+)|(\d+)\/(\d+)|\d*\.\d+|\d+\.\d*|\d+/g;

/** Leading zeros are spelling, not value: `TTB-0016` and `TTB-16` are one part. */
function withoutLeadingZeros(digits: string): string {
    return digits.replace(/^0+(?=\d)/, "");
}

/** One 2-dp decimal, the single form every number is stored and queried as. */
function toDecimal(value: number): string {
    return String(Math.round(value * 100) / 100);
}

/**
 * Rewrites numbers and fractions to one 2-dp decimal, at index and query time
 * alike — which is what lets the raw fragments go unstored.
 */
function canonicalizeNumbers(text: string): string {
    return text.replace(
        NUMERIC_PATTERN,
        (match, mixedWhole, mixedNum, mixedDen, fracNum, fracDen) => {
            // Left as written, so a long one cannot round-trip through a float.
            if (/^\d+$/.test(match)) {
                return withoutLeadingZeros(match);
            }

            let value: number;
            if (mixedWhole !== undefined) {
                const fraction = Number(mixedNum) / Number(mixedDen);
                // A leading zero marks a part number segment rather than a
                // quantity, so `TTB-0016-5/32` is part 16 in 5/32", not 16 and
                // 5/32. Each half still canonicalizes on its own.
                if (mixedWhole.startsWith("0")) {
                    return Number.isFinite(fraction)
                        ? `${withoutLeadingZeros(mixedWhole)}-${toDecimal(fraction)}`
                        : match;
                }
                value = Number(mixedWhole) + fraction;
            } else if (fracNum !== undefined) {
                value = Number(fracNum) / Number(fracDen);
            } else {
                value = Number(match);
            }
            if (!Number.isFinite(value)) {
                return match;
            }
            return toDecimal(value);
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
function uniqueJoin(values: (string | undefined)[]): string {
    return Array.from(
        new Set(values.filter((value): value is string => !!value))
    ).join(" ");
}

/**
 * A part number that only repeats the name identifies nothing — it is what a
 * generic part is given when there is no real number to use — so it is dropped
 * rather than shown, searched, or turned into a vendor link.
 */
function withoutRepeatedPartNumber(
    record: ConfigurationRecord
): ConfigurationRecord {
    const repeated =
        record.partNumber?.trim().toLowerCase() ===
        record.name?.trim().toLowerCase();
    return repeated ? { ...record, partNumber: undefined } : record;
}

/**
 * Keeps the first of each distinct (part number, name) in enumeration order and
 * drops records with neither. First-wins is what keeps the latest revision.
 */
export function toSearchRecords(
    records: ConfigurationRecord[],
    vendors: Vendor[] = []
): SearchRecord[] {
    const seen = new Set<string>();
    const searchRecords: SearchRecord[] = [];
    for (const raw of records) {
        const record = withoutRepeatedPartNumber(raw);
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
            url: getPartUrl(record, vendors),
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
