import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    GrowthOut
} from "@backend/features/analytics/contract";
import { StatTile } from "./stat-tiles";

/**
 * The page's headline: how big this is, and whether it grew.
 *
 * The value is all time and the change beside it is season over season — the
 * two windows a maintainer actually asks about, and the reason each tile's
 * indicator names the season it compares.
 */
export function LifetimeTiles({
    totals,
    growth,
    withOpens = false
}: {
    totals: AnalyticsTotals;
    growth: GrowthOut;
    /** Opens follow whichever library was selected, so app level only. */
    withOpens?: boolean;
}): ReactNode {
    const { season, trackingSince } = growth;

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 3 : 2 }}>
            <StatTile
                label="Total uses"
                value={totals.inserts}
                change={season.inserts}
                trackingSince={trackingSince}
            />
            <StatTile
                label="Total users"
                value={totals.uniqueUsers}
                change={season.activeUsers}
                trackingSince={trackingSince}
            />
            {withOpens && (
                <StatTile
                    label="App sessions"
                    value={totals.appOpens}
                    change={season.appOpens}
                    trackingSince={trackingSince}
                />
            )}
        </SimpleGrid>
    );
}
