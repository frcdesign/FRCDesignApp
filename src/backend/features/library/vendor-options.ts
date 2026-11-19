/**
 * Reading a Vendor parameter's options as the library's vendors. A leaf, so
 * the load's role and build checks and the insert menu agree on every match.
 */
import { getVendorName, Vendor } from "./vendors";

/** The option meaning no vendor in particular: every standard size, without part numbers. */
export const GENERIC_VENDOR_NAME = "Generic";

export enum VendorOptionMatch {
    /** Spelled exactly as `getVendorName` spells it. */
    EXACT = "exact",
    GENERIC = "generic",
    /** The vendor's code, such as WCP, where its name is longer. */
    ABBREVIATION = "abbreviation",
    /** Off by case, punctuation, a few letters, or a word left out. */
    MISSPELLED = "misspelled",
    UNKNOWN = "unknown"
}

export type ReadVendorOption =
    | { match: VendorOptionMatch.EXACT; vendor: Vendor }
    | { match: VendorOptionMatch.GENERIC }
    | {
          match: VendorOptionMatch.ABBREVIATION | VendorOptionMatch.MISSPELLED;
          vendor: Vendor;
      }
    | { match: VendorOptionMatch.UNKNOWN };

/** Letters and digits only, so "McMaster-Carr" and "MCMASTER CARR" agree. */
export function normalizedVendorName(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Shorter than this, a near spelling is as likely another vendor's code. */
const MIN_FUZZY_LENGTH = 5;
const MAX_TYPOS = 2;

function editDistance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[b.length];
}

function isNearSpelling(option: string, name: string): boolean {
    if (option === name) return true;
    if (option.length < MIN_FUZZY_LENGTH) return false;
    // "Thrifty Bot" for "The Thrifty Bot"
    if (name.includes(option) || option.includes(name)) return true;
    return editDistance(option, name) <= MAX_TYPOS;
}

const VENDORS = Object.values(Vendor);

/** Which vendor an option names, and how well. */
export function readVendorOption(option: string): ReadVendorOption {
    const trimmed = option.trim();
    const normalized = normalizedVendorName(trimmed);
    if (normalized === normalizedVendorName(GENERIC_VENDOR_NAME)) {
        return { match: VendorOptionMatch.GENERIC };
    }
    const exact = VENDORS.find((vendor) => getVendorName(vendor) === trimmed);
    if (exact) return { match: VendorOptionMatch.EXACT, vendor: exact };

    const code = VENDORS.find(
        (vendor) => normalizedVendorName(vendor) === normalized
    );
    // A code that is its own name, such as Parker, is only miscased.
    if (
        code &&
        normalizedVendorName(getVendorName(code)) !== normalizedVendorName(code)
    ) {
        return { match: VendorOptionMatch.ABBREVIATION, vendor: code };
    }
    const near = VENDORS.find((vendor) =>
        isNearSpelling(normalized, normalizedVendorName(getVendorName(vendor)))
    );
    return near
        ? { match: VendorOptionMatch.MISSPELLED, vendor: near }
        : { match: VendorOptionMatch.UNKNOWN };
}

/** The vendor an option names, however well; undefined for Generic or none. */
export function optionVendor(option: string): Vendor | undefined {
    const read = readVendorOption(option);
    return "vendor" in read ? read.vendor : undefined;
}

export function isGenericOption(option: string): boolean {
    return readVendorOption(option).match === VendorOptionMatch.GENERIC;
}

/** A parameter is a Vendor parameter when it is named so and most options name a vendor or Generic. */
export function looksLikeVendorOptions(optionNames: string[]): boolean {
    const known = optionNames.filter(
        (name) => readVendorOption(name).match !== VendorOptionMatch.UNKNOWN
    );
    return known.length > 0 && known.length * 2 >= optionNames.length;
}
