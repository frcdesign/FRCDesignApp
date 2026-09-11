/**
 * How search reads text: where names and part numbers break into terms, and how
 * a measurement is spelled. The index is built with these and queried with
 * them, so a change here is a change to both ends at once.
 */
import { isPlaceholderPartNumber } from "../configurations/part-number";
import { clean } from "../../lib/text";
import { PART_NUMBER_FIELD } from "./fields";

/** Where a name breaks: punctuation and space, plus a quote used as a quote. */
const NAME_SEPARATORS = new RegExp("(?<!\\d)\"|[-()',#&\\s/]+");

/** Where a part number breaks into segments, keeping the whole alongside. */
const PART_NUMBER_SEPARATORS = new RegExp("[-/]+");

/** camelCase and PascalCase boundaries: MAXSpline -> max spline, MAXTube -> max tube. */
const WORD_BOUNDARIES = new RegExp(
    "(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])",
    "g"
);

// A mixed number, fraction, decimal or integer. Ordered longest-first so `1-1/2`
// is consumed whole rather than as `1` + `1/2`.
const NUMERIC_PATTERN =
    /(\d+)-(\d+)\/(\d+)|(\d+)\/(\d+)|\d*\.\d+|\d+\.\d*|\d+/g;

/** Leading zeros are spelling, not value: `TTB-0016` and `TTB-16` are one part. */
function withoutLeadingZeros(digits: string): string {
    return digits.replace(/^0+(?=\d)/, "");
}

/** How a measurement is spelled to 2dp: what it rounds to, and what it starts. */
type DecimalSpelling = (value: number) => string;

const rounded: DecimalSpelling = (value) =>
    String(Math.round(value * 100) / 100);
const truncated: DecimalSpelling = (value) =>
    String(Math.trunc(value * 100) / 100);

/**
 * Both spellings, since the library writes the same measurement either way: one
 * vendor's `.2` is the next one's `.19`. Storing both lets either find the part.
 */
const DECIMAL_SPELLINGS: DecimalSpelling[] = [rounded, truncated];

/**
 * One 2-dp decimal at index and query time alike, which is what lets the raw
 * fragments go unstored. Names only: `217-2600` is not two thousand six hundred.
 */
function canonicalizeNumbers(text: string, toDecimal: DecimalSpelling): string {
    return text.replace(
        NUMERIC_PATTERN,
        (
            match: string,
            mixedWhole: string | undefined,
            mixedNum: string | undefined,
            mixedDen: string | undefined,
            fracNum: string | undefined,
            fracDen: string | undefined
        ) => {
            // Left as written, so a long one cannot round-trip through a float.
            if (/^\d+$/.test(match)) {
                return withoutLeadingZeros(match);
            }

            let value: number;
            if (mixedWhole !== undefined) {
                const fraction = Number(mixedNum) / Number(mixedDen);
                // A leading zero marks a part number segment, not a quantity: `TTB-0016-5/32` is
                // part 16 in 5/32", not 16 and 5/32. Each half still canonicalizes on its own.
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
    return canonicalizeNumbers(text, rounded).toLowerCase();
}

/**
 * A name's words, with its sizes in the one decimal spelling. The inch mark
 * stays on its number, so `1"` is a size rather than a prefix of `1.5` and `16t`.
 */
export function tokenizeName(text: string): string[] {
    const tokens = new Set<string>();
    // Canonicalized before splitting: fractions span `/` and `-`. Casing stays,
    // since processTerm splits on camelCase.
    for (const toDecimal of DECIMAL_SPELLINGS) {
        for (const token of splitWithMarks(
            canonicalizeNumbers(text, toDecimal)
        )) {
            tokens.add(token);
        }
    }
    return Array.from(tokens);
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
    return field === PART_NUMBER_FIELD;
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
    const tokens: string[] = [];
    // The name reading keeps its case for processTerm to split camelCase on, so the
    // literal reading of one word is a duplicate rather than a second term.
    const seen = new Set<string>();
    for (const word of text.trim().split(/\s+/)) {
        // Typed, it is still the word for a part number nobody has, and searching its
        // letters would answer with whatever starts with `n` or `a`.
        if (!word || isPlaceholderPartNumber(word)) {
            continue;
        }
        // Segments only what carries a letter, as a part number does: splitting a bare
        // `1/2` would search `1`, and a prefix that short matches every number.
        const literal = /[a-z]/i.test(word)
            ? tokenizePartNumber(word)
            : [word.toLowerCase()];
        for (const token of [...tokenizeName(word), ...literal]) {
            if (seen.has(token.toLowerCase())) {
                continue;
            }
            seen.add(token.toLowerCase());
            tokens.push(token);
        }
    }
    return tokens;
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
