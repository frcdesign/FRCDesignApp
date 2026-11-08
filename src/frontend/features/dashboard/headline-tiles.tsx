import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyMetricPoint,
    GrowthOut
} from "@backend/features/analytics/contract";
import { formatRate } from "./format";
import { perUnit } from "./derived";
import { toSparkSeries } from "./series";
import { StatTile } from "./stat-tiles";
import { m } from "../../paraglide/messages";

interface HeadlineTilesProps {
    /** Over the selected window. */
    totals: AnalyticsTotals;
    /** Season change; only meaningful on All time. */
    growth?: GrowthOut;
    /** Daily points over the selected window, for the sparklines. */
    series: DailyMetricPoint[];
    /** App level only. */
    withOpens?: boolean;
}

export function HeadlineTiles({
    totals,
    growth,
    series,
    withOpens = false
}: HeadlineTilesProps): ReactNode {
    const perUser =
        totals.uniqueUsers === 0 ? 0 : totals.uses / totals.uniqueUsers;
    const spark = toSparkSeries(series);

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
            <StatTile
                label={m.dashboardMetricUses()}
                value={totals.uses}
                change={growth?.uses}
                spark={spark.uses}
            />
            <StatTile
                label={m.dashboardTileUsers()}
                value={totals.uniqueUsers}
                change={growth?.activeUsers}
                spark={spark.activeUsers}
            />
            <StatTile
                label={m.dashboardTileUsesPerUser()}
                value={perUser}
                format={formatRate}
                change={growth && perUnit(growth.uses, growth.activeUsers)}
                spark={spark.usesPerUser}
            />
            {withOpens && (
                <StatTile
                    label={m.dashboardTileAppSessions()}
                    value={totals.appOpens}
                    change={growth?.appOpens}
                    spark={spark.appOpens}
                />
            )}
        </SimpleGrid>
    );
}
