/** How names and part numbers become terms, at both index and query time. */
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

// Longest first, so `1-1/2` isn't read as `1` + `1/2`.
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

// Vendors spell the same size both ways (`.2` and `.19`), so index both.
const DECIMAL_SPELLINGS: DecimalSpelling[] = [rounded, truncated];

/** Names only: `217-2600` is not a number. */
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
                // A leading zero marks a part number: `TTB-0016-5/32` is part 16 in 5/32".
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

/** For direct comparison, so a `.5` query matches a stored `"1/2 Bearing"`. */
export function normalizeForMatch(text: string): string {
    return canonicalizeNumbers(text, rounded).toLowerCase();
}

/** The inch mark stays on its number, so `1"` isn't a prefix of `1.5`. */
export function tokenizeName(text: string): string[] {
    const tokens = new Set<string>();
    // Before splitting, since fractions span `/` and `-`. Case is kept for
    // processTerm's camelCase split.
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
        // `1"x2"` is two sizes.
        for (const token of piece.split(/(?<=")/)) {
            if (token) tokens.push(token);
        }
    }
    return tokens;
}

/** Whole plus segments, so `WCP-1025` is found by either half. */
export function tokenizePartNumber(text: string): string[] {
    const whole = clean(text)?.toLowerCase();
    if (!whole) {
        return [];
    }
    const segments = whole.split(PART_NUMBER_SEPARATORS).filter(Boolean);
    return Array.from(new Set([whole, ...segments]));
}

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

/** Read both as a name and as a part number, since either may be typed. */
export function tokenizeQuery(text: string): string[] {
    const tokens: string[] = [];
    const seen = new Set<string>();
    for (const word of text.trim().split(/\s+/)) {
        // A placeholder like "n/a" would match anything starting with its letters.
        if (!word || isPlaceholderPartNumber(word)) {
            continue;
        }
        // Only words with a letter: splitting a bare `1/2` would search `1`.
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

/** Adds the words in a compound, so `MAXSpline` is found by `spline`. */
export function processTerm(term: string, field?: string): string[] {
    const base = term.toLowerCase();
    if (isPartNumberField(field)) {
        return [base];
    }
    const words = term.split(WORD_BOUNDARIES).map((word) => word.toLowerCase());
    return Array.from(new Set([...words, base]));
}
