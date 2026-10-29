import type { Favorite } from "@backend/features/favorites/contract";
import { sameSelection } from "@backend/features/configurations/selection";
import type { SelectionReport } from "../insert/components/configurations";

/** The favorite's saved configuration where it has one, else the element's own. */
export function isDefaultConfiguration(
    favorite: Favorite | undefined,
    report: SelectionReport
): boolean {
    const saved = favorite?.defaultSelection;
    // Compared as entered: saving "(2 + 3) in" over "5 in" changes what is stored.
    return saved
        ? sameSelection(report.stored, saved)
        : Object.keys(report.overrides).length === 0;
}
