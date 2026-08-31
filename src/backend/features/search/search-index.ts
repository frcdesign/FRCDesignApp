/**
 * Shared index definitions: the backend builds the index, the frontend
 * deserializes it with the same options.
 */
import MiniSearch, { Options } from "minisearch";
import { LibraryOut } from "../library/contract";
import { Vendor } from "../library/vendors";
import { ConfigurationRecord, SearchRecord } from "../configurations/models";
import { getPartUrl } from "../configurations/utils";
import { meaningfulPartNumber } from "../configurations/part-number";
import { clean } from "../../lib/text";

/** Where a name breaks: punctuation and space, plus a quote used as a quote. */
const NAME_SEPARATORS = new RegExp("(?<!\\d)\"|[-()',#&\\s/]+");

/** Where a part number breaks into segments, keeping the whole alongside. */
const PART_NUMBER_SEPARATORS = new RegExp("[-/]+");

/** camelCase and PascalCase boundaries: MAXSpline -> max spline, MAXTube -> max tube. */
const WORD_BOUNDARIES = new RegExp(
    "(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])",
    "g"
);

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
 * alike — which is what lets the raw fragments go unstored. Names only: a part
 * number is an identifier, and 217-2600 is not two thousand six hundred.
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
 * For direct, non-tokenized comparison: the index's canonicalization,
 * lowercased, so a `.5` query lines up with a stored `"1/2 Bearing"`.
 */
export function normalizeForMatch(text: string): string {
    return canonicalizeNumbers(text).toLowerCase();
}

/**
 * A name's words, with its sizes in the one decimal spelling. The inch mark
 * stays on its number, so `1"` is a size rather than a prefix of `1.5` and `16t`.
 */
export function tokenizeName(text: string): string[] {
    // Canonicalized before splitting: fractions span `/` and `-`. Casing stays,
    // since processTerm splits on camelCase.
    return splitWithMarks(canonicalizeNumbers(text));
}

/** Splits on `NAME_SEPARATORS`, keeping a `"` that measures its number. */
function splitWithMarks(text: string): string[] {
    const tokens: string[] = [];
    for (const piece of text.split(NAME_SEPARATORS)) {
        // The split consumed the separators, so an inch mark left inside a
        // piece ends the token it measures: `1"x2"` is two sizes.
        for (const token of piece.split(/(?<=")/)) {
            if (token) tokens.push(token);
        }
    }
    return tokens;
}

/**
 * A part number identifies, it does not describe: it is indexed as typed, plus
 * its segments, so `WCP-1025` is found by the whole number or either half.
 */
export function tokenizePartNumber(text: string): string[] {
    const whole = clean(text)?.toLowerCase();
    if (!whole) {
        return [];
    }
    const segments = whole.split(PART_NUMBER_SEPARATORS).filter(Boolean);
    return Array.from(new Set([whole, ...segments]));
}

/** The fields holding an identifier rather than a description. */
function isPartNumberField(field?: string): boolean {
    return field === "partNumbers";
}

/** Splits a field's text the way that field reads; a query has no field. */
export function tokenize(text: string, field?: string): string[] {
    if (field === undefined) {
        return tokenizeQuery(text);
    }
    return isPartNumberField(field)
        ? tokenizePartNumber(text)
        : tokenizeName(text);
}

/**
 * A query is split both ways, since the caller may have typed either kind of
 * text: the words of a name, and the literal a part number is indexed as.
 */
export function tokenizeQuery(text: string): string[] {
    const tokens = new Set(tokenizeName(text));
    for (const word of text.trim().toLowerCase().split(/\s+/)) {
        if (!word) {
            continue;
        }
        // Segments only for something carrying a letter, which is what a part
        // number does: splitting a bare `1/2` would search `1`, and a prefix
        // that short matches every number in the library.
        for (const token of /[a-z]/.test(word)
            ? tokenizePartNumber(word)
            : [word]) {
            tokens.add(token);
        }
    }
    // A lone letter is the leftover of splitting something like `n/a`, and as a
    // prefix it matches most of the library. A lone digit is a size, so it stays.
    return Array.from(tokens).filter((token) => !/^[a-z]$/i.test(token));
}

/**
 * Adds the words inside a compound term, so `MAXSpline` is found by `spline`.
 * A part number is left whole: its segments are already separate tokens.
 */
export function processTerm(term: string, field?: string): string[] {
    const base = term.toLowerCase();
    if (isPartNumberField(field)) {
        return [base];
    }
    const words = term.split(WORD_BOUNDARIES).map((word) => word.toLowerCase());
    return Array.from(new Set([...words, base]));
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
 * Keeps the first of each distinct (part number, name) in enumeration order and
 * drops records with neither. First-wins is what keeps the latest revision. A
 * number that identifies nothing is dropped here, so it never reaches the
 * index, the stored records, or a vendor url.
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
            configuration: raw.configuration
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
