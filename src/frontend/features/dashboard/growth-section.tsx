import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type DailyMetricPoint,
    type GrowthOut
} from "@backend/features/analytics/contract";
import { MONTH_DAYS } from "@backend/features/analytics/measures";
import { formatRate } from "./change-indicator";
import { perUnit } from "./derived";
import { Section } from "./section";
import { StatTile } from "./stat-tiles";
import { toSparkSeries } from "./series";

interface RecentSectionProps {
    growth: GrowthOut;
    /** Every recorded day; sliced to the window the tiles report on. */
    series: DailyMetricPoint[];
}

/**
 * The trailing month against the one before it: what says something useful
 * before there is a second season to compare against.
 */
export function RecentSection({
    growth,
    series
}: RecentSectionProps): ReactNode {
    const { recent } = growth;
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
        <Section title={`Last ${MONTH_DAYS} days`}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <StatTile
                    label="Total uses"
                    value={recent.inserts.current}
                    change={recent.inserts}
                    spark={spark.inserts}
                />
                <StatTile
                    label="Total users"
                    value={recent.activeUsers.current}
                    change={recent.activeUsers}
                    spark={spark.activeUsers}
                />
                <StatTile
                    label="Uses per user"
                    value={perUser.current}
                    change={perUser}
                    format={formatRate}
                    spark={spark.usesPerUser}
                />
                {/* Matches the card above it in the Overall row, so the two
                    rows line up column by column. */}
                <StatTile
                    label="App sessions"
                    value={recent.appOpens.current}
                    change={recent.appOpens}
                    spark={spark.appOpens}
                />
            </SimpleGrid>
        </Section>
    );
}
