/**
 * How names and part numbers become terms. Each term keeps where it sits in
 * its text, so what was indexed is also what gets underlined.
 */
import { isPlaceholderPartNumber } from "../configurations/part-number";
import { PART_NUMBER_FIELD } from "./fields";

/** One term, and the characters of its text it was read from. */
export interface TermSpan {
    /** Lowercase, and numbers in canonical decimal form. */
    term: string;
    start: number;
    end: number;
    /** Spelled as written, so a typed prefix of it can be underlined alone. */
    literal: boolean;
}

/**
 * A piece of a name: a mixed number or fraction, which spans the separators,
 * else a run between them. A mixed number's whole can't lead with a zero, so
 * `TTB-0016-5/32` stays part 16 in 5/32.
 */
const NAME_PIECE = /[1-9]\d*-\d+\/\d+|\d+\/\d+|[^\s\-()',#&/"]+/g;

/** camelCase and PascalCase boundaries: MAXSpline -> MAX Spline. */
const WORD_BOUNDARY = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;

const MIXED = /^(\d+)-(\d+)\/(\d+)$/;
const FRACTION = /^(\d+)\/(\d+)$/;
const DECIMAL = /^(\d*\.\d+|\d+\.\d*)$/;
const INTEGER = /^\d+$/;

/** A size's value, or undefined for anything that isn't one. */
function numericValue(piece: string): number | undefined {
    const mixed = MIXED.exec(piece);
    if (mixed) {
        return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    }
    const fraction = FRACTION.exec(piece);
    if (fraction) {
        return Number(fraction[1]) / Number(fraction[2]);
    }
    return DECIMAL.test(piece) ? Number(piece) : undefined;
}

/**
 * To 2dp both rounded and truncated, since vendors write `.196` as `.2` and
 * as `.19`.
 */
function decimalSpellings(value: number): string[] {
    const rounded = String(Math.round(value * 100) / 100);
    const truncated = String(Math.trunc(value * 100) / 100);
    return rounded === truncated ? [rounded] : [rounded, truncated];
}

function pieceSpans(piece: string, start: number): TermSpan[] {
    const end = start + piece.length;
    if (INTEGER.test(piece)) {
        // Leading zeros are spelling, not value: `TTB-0016` is part 16.
        const term = piece.replace(/^0+(?=\d)/, "");
        return [{ term, start, end, literal: term === piece }];
    }
    const value = numericValue(piece);
    if (value !== undefined && Number.isFinite(value)) {
        return decimalSpellings(value).map((term) => ({
            term,
            start,
            end,
            literal: false
        }));
    }
    const spans: TermSpan[] = [
        { term: piece.toLowerCase(), start, end, literal: true }
    ];
    // So `MAXSpline` is found by `spline`.
    const words = piece.split(WORD_BOUNDARY);
    let offset = start;
    for (const word of words.length > 1 ? words : []) {
        spans.push({
            term: word.toLowerCase(),
            start: offset,
            end: offset + word.length,
            literal: true
        });
        offset += word.length;
    }
    return spans;
}

/** A name describes the part, so `1/2`, `.5` and `0.50` read as one size. */
export function nameSpans(text: string): TermSpan[] {
    return [...text.matchAll(NAME_PIECE)].flatMap((match) =>
        pieceSpans(match[0], match.index)
    );
}

/**
 * A part number identifies, so it is read literally: whole, and by segment.
 * Space-separated runs are read apart, since the index joins every part
 * number an element has with spaces.
 */
export function partNumberSpans(text: string): TermSpan[] {
    return [...text.matchAll(/\S+/g)].flatMap((match) => {
        const whole = match[0];
        const spans: TermSpan[] = [
            {
                term: whole.toLowerCase(),
                start: match.index,
                end: match.index + whole.length,
                literal: true
            }
        ];
        for (const segment of whole.matchAll(/[^-/]+/g)) {
            if (segment[0] === whole) continue;
            const start = match.index + segment.index;
            spans.push({
                term: segment[0].toLowerCase(),
                start,
                end: start + segment[0].length,
                literal: true
            });
        }
        return spans;
    });
}

function uniqueTerms(spans: TermSpan[]): string[] {
    return [...new Set(spans.map((span) => span.term))];
}

/**
 * Each word of a query and every way it could be meant: as a name reads it,
 * and, for a word with a letter, as a part number. A bare `1/2` isn't split,
 * or it would search `1`.
 */
export function queryWords(query: string): string[][] {
    return (
        query
            .trim()
            .split(/\s+/)
            // A placeholder like "n/a" would match anything starting with its letters.
            .filter((word) => word && !isPlaceholderPartNumber(word))
            .map((word) => {
                const literal = /[a-z]/i.test(word)
                    ? uniqueTerms(partNumberSpans(word))
                    : [word.toLowerCase()];
                return [
                    ...new Set([...uniqueTerms(nameSpans(word)), ...literal])
                ];
            })
            .filter((terms) => terms.length > 0)
    );
}

/** MiniSearch's tokenizer: a field's text, or one query word (which has no field). */
export function tokenize(text: string, field?: string): string[] {
    if (field === undefined) {
        return queryWords(text).flat();
    }
    return uniqueTerms(
        field === PART_NUMBER_FIELD ? partNumberSpans(text) : nameSpans(text)
    );
}
