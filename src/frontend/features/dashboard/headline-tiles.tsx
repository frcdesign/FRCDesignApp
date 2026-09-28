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

interface HeadlineTilesProps {
    /** Over the selected window. */
    totals: AnalyticsTotals;
    /**
     * The season comparison, which belongs to an all-time total: passed only
     * when the window is all of it, since a season's change against a week's
     * number is two different stretches read as one.
     */
    growth?: GrowthOut;
    /** Daily points over the selected window, for the sparklines. */
    series: DailyMetricPoint[];
    /** An open belongs to no library, so app level only. */
    withOpens?: boolean;
}

export function HeadlineTiles({
    totals,
    growth,
    series,
    withOpens = false
}: HeadlineTilesProps): ReactNode {
    const perUser =
        totals.uniqueUsers === 0 ? 0 : totals.inserts / totals.uniqueUsers;
    const spark = toSparkSeries(series);

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
            <StatTile
                label="Total uses"
                value={totals.inserts}
                change={growth?.inserts}
                spark={spark.inserts}
            />
            <StatTile
                label="Total users"
                value={totals.uniqueUsers}
                change={growth?.activeUsers}
                spark={spark.activeUsers}
            />
            <StatTile
                label="Uses per user"
                value={perUser}
                format={formatRate}
                change={growth && perUnit(growth.inserts, growth.activeUsers)}
                spark={spark.usesPerUser}
            />
            {withOpens && (
                <StatTile
                    label="App sessions"
                    value={totals.appOpens}
                    change={growth?.appOpens}
                    spark={spark.appOpens}
                />
            )}
        </SimpleGrid>
    );
}
