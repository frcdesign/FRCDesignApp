/**
 * Which configuration a hit names. Kept beside the tokenizers it scores with,
 * and MiniSearch-free: the caller says which fields matched, so the same
 * scoring can answer for anything holding records.
 */
import {
    type ConfigurationRecord,
    DEFAULT_CONFIGURATION_KEY,
    SearchRecord
} from "../configurations/contract";
import { getPartUrl } from "../configurations/utils";
import { meaningfulPartNumber } from "../configurations/part-number";
import { Vendor } from "../library/vendors";
import { clean } from "../../lib/text";
import {
    normalizeForMatch,
    tokenizeName,
    tokenizePartNumber
} from "./tokenize";
import { CONFIGURATION_FIELDS } from "./contract";

const [PART_NUMBER_FIELD, PART_NAME_FIELD] = CONFIGURATION_FIELDS;

/**
 * The element's own defaults first. `toKey` leaves out whatever a selection does
 * not override, so that record is the one keyed by the empty string.
 *
 * Records arrive in the order `enumerateConfigurations` produced them, which is
 * option declaration order — the default lands wherever Onshape happens to
 * declare it, and for a boolean parameter defaulting to false it is never first.
 */
function defaultFirst(records: SearchRecord[]): SearchRecord[] {
    const index = records.findIndex(
        (record) => record.configurationKey === DEFAULT_CONFIGURATION_KEY
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

/**
 * The best record by part number or name, whichever the query describes better,
 * else the default — so a row shows one even when only the title matched.
 */
export function matchedRecord(
    query: string,
    documentRecords: SearchRecord[],
    matchedFields: string[]
): SearchRecord | undefined {
    // Reordered once, so the tie-break inside findBestRecord and the fallback
    // below both land on the configuration the insert menu opens with.
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

/**
 * How a field's text is read for scoring: a part number is compared as typed,
 * a name around the decimals its sizes are indexed as.
 */
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

/**
 * A term matched whole beats one matched as a prefix, which every longer number
 * satisfies too: `1` names the size `1"`, but only starts `16`.
 */
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

/**
 * How well a value answers the query: a whole-query match ranks above any
 * number of loose terms, so a part number typed out in full still wins.
 */
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

/**
 * Scored by term rather than by the whole query, which "maxspline 24t" matches
 * no record as. Ties go to whichever came first in `records`, which
 * {@link defaultFirst} has already put the element's defaults at the front of.
 */
function findBestRecord(
    query: string,
    records: SearchRecord[],
    selector: (record: SearchRecord) => string | undefined,
    field: FieldReader
): RecordMatch | undefined {
    // Read the query the way the field was indexed, so a `.5` query lines up
    // with a stored "1/2 Bearing" and a typed part number with itself.
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
