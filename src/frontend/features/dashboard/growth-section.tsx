import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type DailyMetricPoint,
    type GrowthOut
} from "@backend/features/analytics/contract";
import { RECENT_DAYS } from "@backend/features/analytics/measures";
import { formatRate } from "./change-indicator";
import { ComparisonTile } from "./comparison-tile";
import { perUnit } from "./derived";
import { Section } from "./section";
import { toSparkSeries } from "./series";

/**
 * The trailing month against the month before it.
 *
 * The section that says something useful from the first weeks of tracking,
 * before there is a second season to compare against.
 */
export function RecentSection({
    growth,
    series
}: {
    growth: GrowthOut;
    /** Every recorded day; sliced to the window the tiles report on. */
    series: DailyMetricPoint[];
}): ReactNode {
    const { recent, trackingSince } = growth;
    const perUser = perUnit(recent.inserts, recent.activeUsers);
    // The sparkline covers exactly the days the number above it counts.
    const spark = toSparkSeries(
        series.filter(
            (point) =>
                point.day >= recent.inserts.currentFrom &&
                point.day <= recent.inserts.currentTo
        )
    );

    return (
        <Section title={`Last ${RECENT_DAYS} days`}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <ComparisonTile
                    label="Total uses"
                    comparison={recent.inserts}
                    trackingSince={trackingSince}
                    spark={spark.inserts}
                />
                <ComparisonTile
                    label="Total users"
                    comparison={recent.activeUsers}
                    trackingSince={trackingSince}
                    spark={spark.activeUsers}
                />
                <ComparisonTile
                    label="Uses per user"
                    comparison={perUser}
                    trackingSince={trackingSince}
                    format={formatRate}
                    spark={spark.usesPerUser}
                />
                {/* Matches the card above it in the Overall row, so the two
                    rows line up column by column. */}
                <ComparisonTile
                    label="App sessions"
                    comparison={recent.appOpens}
                    trackingSince={trackingSince}
                    spark={spark.appOpens}
                />
            </SimpleGrid>
        </Section>
    );
}
