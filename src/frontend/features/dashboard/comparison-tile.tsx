import { type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { StatTile } from "./stat-tiles";

/**
 * A `StatTile` whose number and change come from one comparison, so the two
 * cannot be passed from different windows by mistake.
 */
export function ComparisonTile({
    label,
    comparison,
    trackingSince,
    format,
    spark
}: {
    label: string;
    comparison: PeriodComparison;
    trackingSince: string | null;
    /** Rates need a decimal; counts do not. */
    format?: (value: number) => string;
    /** The measure's shape across exactly the window it reports on. */
    spark?: number[];
}): ReactNode {
    return (
        <StatTile
            label={label}
            value={comparison.current}
            format={format}
            change={comparison}
            trackingSince={trackingSince}
            spark={spark}
        />
    );
}
