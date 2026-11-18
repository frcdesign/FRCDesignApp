/** A team's preferred vendors order lists and break ties; they never hide a part. */
import { getVendorName, type Vendor } from "@backend/features/library/vendors";

/** Where a part's best vendor ranks; a part from no ranked vendor ranks last. */
export function vendorRank(vendors: Vendor[], ranking: Vendor[]): number {
    const ranks = vendors
        .map((vendor) => ranking.indexOf(vendor))
        .filter((rank) => rank >= 0);
    return ranks.length > 0 ? Math.min(...ranks) : ranking.length;
}

/** The ranked vendors first, in the team's order, then the rest as given. */
export function orderVendors(vendors: Vendor[], ranking: Vendor[]): Vendor[] {
    return [...vendors].sort(
        (a, b) => vendorRank([a], ranking) - vendorRank([b], ranking)
    );
}

/** Stable: only items `isTie` says are tied swap, the better-ranked vendor first. */
export function breakTiesByVendor<T>(
    items: T[],
    vendorsOf: (item: T) => Vendor[],
    isTie: (a: T, b: T) => boolean,
    ranking: Vendor[]
): T[] {
    if (ranking.length === 0) return items;
    const sorted = [...items];
    // Insertion sort within each run of ties, so the search's order otherwise stands.
    for (let i = 1; i < sorted.length; i++) {
        for (
            let j = i;
            j > 0 &&
            isTie(sorted[j - 1], sorted[j]) &&
            vendorRank(vendorsOf(sorted[j]), ranking) <
                vendorRank(vendorsOf(sorted[j - 1]), ranking);
            j--
        ) {
            [sorted[j - 1], sorted[j]] = [sorted[j], sorted[j - 1]];
        }
    }
    return sorted;
}

/** A catalog's vendor, which another list names by its own id. */
export interface NamedVendor {
    id: string;
    name: string;
}

/** Letters and digits only, so "McMaster-Carr" and "MCMASTERCARR" agree. */
function normalized(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A vendor of another list is a library's when its id or name is the library vendor's code or name. */
function isSameVendor(candidate: NamedVendor, vendor: Vendor): boolean {
    const names = [vendor, getVendorName(vendor)].map(normalized);
    return [candidate.id, candidate.name]
        .map(normalized)
        .some((name) => names.includes(name));
}

/** The best-ranked of `candidates`, such as Auto Assembly's catalog vendors; undefined when none is ranked. */
export function preferredVendor(
    candidates: NamedVendor[],
    ranking: Vendor[]
): NamedVendor | undefined {
    const rankOf = (candidate: NamedVendor) =>
        ranking.findIndex((vendor) => isSameVendor(candidate, vendor));
    return candidates
        .filter((candidate) => rankOf(candidate) >= 0)
        .sort((a, b) => rankOf(a) - rankOf(b))[0];
}
