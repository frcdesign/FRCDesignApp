import { SimpleGrid } from "@mantine/core";
import { Star } from "@phosphor-icons/react";
import { lazy, Suspense, type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { METRICS, type MetricKey } from "./metrics";
import { TrendTile } from "./trend-tile";
import { StatTile } from "./stat-tiles";

const LibraryInsertsChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.LibraryInsertsChart
    }))
);

/** The order tiles appear in on the app dashboard. */
const TILE_ORDER: MetricKey[] = [
    "inserts",
    "appOpens",
    "activeUsers",
    "fastenShare",
    "quickShare"
];

/**
 * The library view drops app opens: the panel is opened once for the app, not
 * for a library, so attributing an open to whichever library happened to be
 * selected would count the same event differently depending on a preference.
 */
const LIBRARY_TILE_ORDER: MetricKey[] = TILE_ORDER.filter(
    (key) => key !== "appOpens"
);

interface TrendTilesProps {
    totals: AnalyticsTotals;
    series: DailyMetricPoint[];
    /**
     * Per-library inserts. When given, the inserts tile's detail splits by
     * library instead of showing a single line.
     */
    librarySeries?: DailyInsertPoint[];
    /** Scoped to one library, which has no meaningful app-open count. */
    scopedToLibrary?: boolean;
}

export function TrendTiles({
    totals,
    series,
    librarySeries,
    scopedToLibrary = false
}: TrendTilesProps): ReactNode {
    const order = scopedToLibrary ? LIBRARY_TILE_ORDER : TILE_ORDER;

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {/* Favorites are current state, not a series, so this is a plain
                count rather than a tile with a trend under it. */}
            <StatTile label="Favorites" value={totals.favorites} icon={Star} />
            {order.map((key) => (
                <TrendTile
                    key={key}
                    metric={METRICS[key]}
                    totals={totals}
                    series={series}
                    detail={
                        key === "inserts" && librarySeries ? (
                            <Suspense
                                fallback={<div style={{ height: 200 }} />}
                            >
                                <LibraryInsertsChart series={librarySeries} />
                            </Suspense>
                        ) : undefined
                    }
                />
            ))}
        </SimpleGrid>
    );
}
