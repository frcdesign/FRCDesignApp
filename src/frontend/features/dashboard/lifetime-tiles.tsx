import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyMetricPoint,
    GrowthOut
} from "@backend/features/analytics/contract";
import { formatRate } from "./change-indicator";
import { perUnit } from "./derived";
import { toSparkSeries } from "./series";
import { StatTile } from "./stat-tiles";

/**
 * The page's headline: an all-time value with a season-over-season change, the
 * two windows a maintainer actually asks about.
 */
export function LifetimeTiles({
    totals,
    growth,
    series,
    withOpens = false
}: {
    totals: AnalyticsTotals;
    growth: GrowthOut;
    /** Daily points over the selected window, for the sparklines. */
    series: DailyMetricPoint[];
    /** Opens follow whichever library was selected, so app level only. */
    withOpens?: boolean;
}): ReactNode {
    const { season, trackingSince } = growth;
    const perUser =
        totals.uniqueUsers === 0 ? 0 : totals.inserts / totals.uniqueUsers;
    const spark = toSparkSeries(series);

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
            <StatTile
                label="Total uses"
                value={totals.inserts}
                change={season.inserts}
                trackingSince={trackingSince}
                spark={spark.inserts}
            />
            <StatTile
                label="Total users"
                value={totals.uniqueUsers}
                change={season.activeUsers}
                trackingSince={trackingSince}
                spark={spark.activeUsers}
            />
            {/* Lifetime uses over everyone who ever used it, against a season's
                uses over the people active in that season — the same
                value-and-delta split every tile in this row has. */}
            <StatTile
                label="Uses per user"
                value={perUser}
                format={formatRate}
                change={perUnit(season.inserts, season.activeUsers)}
                trackingSince={trackingSince}
                spark={spark.usesPerUser}
            />
            {withOpens && (
                <StatTile
                    label="App sessions"
                    value={totals.appOpens}
                    change={season.appOpens}
                    trackingSince={trackingSince}
                    spark={spark.appOpens}
                />
            )}
        </SimpleGrid>
    );
}
