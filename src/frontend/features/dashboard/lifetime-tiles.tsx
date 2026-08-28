import { SimpleGrid } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    GrowthOut
} from "@backend/features/analytics/contract";
import { formatRate } from "./change-indicator";
import { perUnit } from "./derived";
import { StatTile } from "./stat-tiles";

/**
 * The page's headline: how big this is, and whether it grew.
 *
 * The value is all time and the change beside it is season over season — the
 * two windows a maintainer actually asks about.
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
    const perUser =
        totals.uniqueUsers === 0 ? 0 : totals.inserts / totals.uniqueUsers;

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
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
            {/* Lifetime uses over everyone who ever used it, against a season's
                uses over the people active in that season — the same
                value-and-delta split every tile in this row has. */}
            <StatTile
                label="Uses per user"
                value={formatRate(perUser)}
                change={perUnit(season.inserts, season.activeUsers)}
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
