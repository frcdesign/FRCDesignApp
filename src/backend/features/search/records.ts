/** Picks which configuration a hit names. MiniSearch-free, so any caller holding records can use it. */
import {
    type ConfigurationParameter,
    type ConfigurationRecord,
    type PartMetadata,
    type SearchRecord
} from "../configurations/contract";
import { toKey, toSelection } from "../configurations/selection";
import { getPartUrl } from "../configurations/utils";
import { meaningfulPartNumber } from "../configurations/part-number";
import { Vendor } from "../library/vendors";
import { clean } from "../../lib/text";
import {
    normalizeForMatch,
    tokenizeName,
    tokenizePartNumber
} from "./tokenize";
import { PART_NAME_FIELD, PART_NUMBER_FIELD } from "./fields";

/**
 * Moves the record naming no values to the front. Records come in Onshape's
 * declaration order, where the default can land anywhere.
 */
function defaultFirst(records: SearchRecord[]): SearchRecord[] {
    const index = records.findIndex(
        (record) => Object.keys(record.values).length === 0
    );
    if (index <= 0) {
        return records;
    }
    return [
        records[index],
        ...records.slice(0, index),
        ...records.slice(index + 1)
    ];
}

/** Falls back to the default, so a row shows one even when only the title matched. */
export function matchedRecord(
    query: string,
    documentRecords: SearchRecord[],
    matchedFields: string[]
): SearchRecord | undefined {
    // So ties and the fallback land on what the insert menu opens with.
    const records = defaultFirst(documentRecords);
    const byNumber = matchedFields.includes(PART_NUMBER_FIELD)
        ? findBestRecord(query, records, (r) => r.partNumber, LITERAL)
        : undefined;
    const byName = matchedFields.includes(PART_NAME_FIELD)
        ? findBestRecord(query, records, (r) => r.name, DESCRIPTIVE)
        : undefined;

    const best = [byNumber, byName]
        .filter((match) => match !== undefined)
        // Part number first, so it wins a tie: it is the more specific field.
        .sort((a, b) => b.score - a.score)[0];
    return best?.record ?? records[0];
}

interface RecordMatch {
    record: SearchRecord;
    score: number;
}

interface FieldReader {
    normalize: (text: string) => string;
    terms: (text: string) => string[];
}

/** A part number identifies: `217-2600` is a code, not a number. */
const LITERAL: FieldReader = {
    normalize: (text) => text.trim().toLowerCase(),
    terms: tokenizePartNumber
};

/** A name describes, so `1/2`, `.5` and `0.5` are one size. */
const DESCRIPTIVE: FieldReader = {
    normalize: normalizeForMatch,
    terms: (text) => tokenizeName(text).map((term) => term.toLowerCase())
};

/** A whole match beats a prefix: `1` names `1"` but only starts `16`. */
function termScore(valueTerms: string[], queryTerm: string): number {
    // A unit is not part of the number's spelling, so `1` still names `1"`.
    if (
        valueTerms.includes(queryTerm) ||
        valueTerms.includes(queryTerm + '"')
    ) {
        return 2;
    }
    return valueTerms.some((valueTerm) => valueTerm.startsWith(queryTerm))
        ? 1
        : 0;
}

/** How much of the query the value covers, term by term. */
function coveredTerms(
    value: string,
    queryTerms: string[],
    field: FieldReader
): number {
    const valueTerms = field.terms(value);
    return queryTerms.reduce(
        (score, queryTerm) => score + termScore(valueTerms, queryTerm),
        0
    );
}

/** A whole-query match beats any number of loose terms. */
function matchScore(
    value: string,
    normalizedQuery: string,
    queryTerms: string[],
    field: FieldReader
): number {
    let whole = 0;
    if (value === normalizedQuery) {
        whole = 3;
    } else if (value.startsWith(normalizedQuery)) {
        whole = 2;
    } else if (value.includes(normalizedQuery)) {
        whole = 1;
    }
    // Outweighs full term coverage, which is worth 2 a term.
    return (
        whole * (2 * queryTerms.length + 1) +
        coveredTerms(value, queryTerms, field)
    );
}

/** Scored per term, since a query like "maxspline 24t" matches no record whole. Ties go to the earliest. */
function findBestRecord(
    query: string,
    records: SearchRecord[],
    selector: (record: SearchRecord) => string | undefined,
    field: FieldReader
): RecordMatch | undefined {
    const normalizedQuery = field.normalize(query.trim());
    if (records.length === 0 || normalizedQuery === "") {
        return undefined;
    }
    const queryTerms = field.terms(query);

    let best: RecordMatch | undefined;
    for (const record of records) {
        const value = field.normalize(selector(record) ?? "");
        if (!value) continue;
        const score = matchScore(value, normalizedQuery, queryTerms, field);
        if (score > (best?.score ?? 0)) {
            best = { record, score };
        }
    }
    return best;
}

/** Drops records that identify nothing. */
export function toSearchRecords(
    records: ConfigurationRecord[],
    parameters: ConfigurationParameter[],
    vendors: Vendor[] = []
): SearchRecord[] {
    const searchRecords: SearchRecord[] = [];
    for (const record of records) {
        const partNumber = meaningfulPartNumber(record.partNumber, record.name);
        const name = clean(record.name);
        if (!partNumber && !name) {
            continue;
        }
        searchRecords.push({
            partNumber,
            name,
            url: getPartUrl({ ...record, partNumber }, vendors),
            values: record.values,
            configurationKey: toKey(
                toSelection(record.values, parameters),
                parameters
            )
        });
    }
    return searchRecords;
}

/**
 * First of each distinct (part number, name), which keeps the latest revision.
 * Enough for the index, which only picks a hit's record.
 */
export function distinctRecords(records: SearchRecord[]): SearchRecord[] {
    const seen = new Set<string>();
    return records.filter((record) => {
        const key = JSON.stringify([record.partNumber, record.name]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/** An insertable's stored configuration data, as the joined rows read it. */
export interface StoredConfiguration {
    /** The element's own part data; null when it has none to show. */
    partMetadata: PartMetadata | null;
    /** Null for an element with nothing to configure, which has no row. */
    parameters: ConfigurationParameter[] | null;
    records: ConfigurationRecord[] | null;
    vendors: Vendor[];
}

/** The element's own part data first, then one per indexed configuration. */
export function searchRecordsOf(stored: StoredConfiguration): SearchRecord[] {
    const own: ConfigurationRecord[] = stored.partMetadata
        ? [{ ...stored.partMetadata, values: {} }]
        : [];
    return toSearchRecords(
        [...own, ...(stored.records ?? [])],
        stored.parameters ?? [],
        stored.vendors
    );
}
