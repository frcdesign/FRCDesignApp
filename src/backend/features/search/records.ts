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
import { nameSpans, partNumberSpans, queryWords } from "./tokenize";
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

/** The terms of a record's field, as the index read them. */
type RecordTerms = (record: SearchRecord) => string[];

const PART_NUMBER_TERMS: RecordTerms = (record) =>
    partNumberSpans(record.partNumber ?? "").map((span) => span.term);

const PART_NAME_TERMS: RecordTerms = (record) =>
    nameSpans(record.name ?? "").map((span) => span.term);

/** A whole term beats a prefix: `1` names a `1"` shaft but only starts `16`. */
function termScore(terms: string[], queryTerm: string): number {
    if (terms.includes(queryTerm)) {
        return 2;
    }
    if (terms.some((term) => term.startsWith(queryTerm))) {
        return 1;
    }
    return 0;
}

/**
 * The record whose matched fields cover most of the query, every reading of
 * each word counting. Falls back to the default, so a row shows one even when
 * only the title matched; ties go to it too, as the insert menu opens on it.
 */
export function matchedRecord(
    query: string,
    documentRecords: SearchRecord[],
    matchedFields: string[]
): SearchRecord | undefined {
    const records = defaultFirst(documentRecords);
    const readers: RecordTerms[] = [];
    if (matchedFields.includes(PART_NUMBER_FIELD)) {
        readers.push(PART_NUMBER_TERMS);
    }
    if (matchedFields.includes(PART_NAME_FIELD)) {
        readers.push(PART_NAME_TERMS);
    }
    const queryTerms = queryWords(query).flat();

    let best = records[0];
    let bestScore = 0;
    for (const record of records) {
        const terms = readers.flatMap((read) => read(record));
        const score = queryTerms.reduce(
            (total, queryTerm) => total + termScore(terms, queryTerm),
            0
        );
        if (score > bestScore) {
            best = record;
            bestScore = score;
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
