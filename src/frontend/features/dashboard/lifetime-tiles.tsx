import { SimpleGrid } from "@mantine/core";
import { AppWindow, PuzzlePiece, Star, Users } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { AnalyticsTotals } from "@backend/features/analytics/contract";
import { StatTile } from "./stat-tiles";

/** Scale, all time. Separated from growth so a level never reads as a change. */
export function LifetimeTiles({
    totals,
    withOpens = false
}: {
    totals: AnalyticsTotals;
    /** Opens are attributed to whichever library was selected, so app only. */
    withOpens?: boolean;
}): ReactNode {
    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
            <StatTile
                label="Total uses"
                value={totals.inserts}
                icon={PuzzlePiece}
            />
            <StatTile
                label="People reached"
                value={totals.uniqueUsers}
                icon={Users}
            />
            {withOpens && (
                <StatTile
                    label="App opens"
                    value={totals.appOpens}
                    icon={AppWindow}
                />
            )}
            <StatTile label="Favorites" value={totals.favorites} icon={Star} />
        </SimpleGrid>
    );
}
