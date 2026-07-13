import { SearchResult as MiniSearchResult } from "minisearch";

/**
 * Global deliminator character used when splitting terms.
 *
 * Intended to be a unique character that doesn't otherwise get used.
 */
export const deliminator = "^";

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
export function tokenize(text: string): string[] {
    // Don't lowercase so we can use casing for term splitting
    // Remove -, (, ), ", ', #, &, /, and whitespace
    return text.split(/[-()"'#&\s^/]+/).filter(Boolean);
}

/**
 * A MiniSearch result with its stored fields typed as `Document`.
 */
export type TypedMiniSearchResult<SearchDocument> = SearchDocument &
    Pick<MiniSearchResult, "terms" | "queryTerms" | "score" | "match">;
