import { SimpleGrid } from "@mantine/core";
import { lazy, Suspense, type ReactNode } from "react";
import type {
    AnalyticsTotals,
    DailyInsertPoint,
    DailyMetricPoint
} from "@backend/features/analytics/contract";
import { METRICS, type MetricKey } from "./metrics";
import { TrendTile } from "./trend-tile";

const LibraryInsertsChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.LibraryInsertsChart
    }))
);

/** The order tiles appear in, across both dashboard views. */
const TILE_ORDER: MetricKey[] = [
    "inserts",
    "appOpens",
    "activeUsers",
    "favoriteShare",
    "fastenShare",
    "quickShare"
];

interface TrendTilesProps {
    totals: AnalyticsTotals;
    series: DailyMetricPoint[];
    /**
     * Per-library inserts. When given, the inserts tile's detail splits by
     * library instead of showing a single line.
     */
    librarySeries?: DailyInsertPoint[];
}

export function TrendTiles({
    totals,
    series,
    librarySeries
}: TrendTilesProps): ReactNode {
    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {TILE_ORDER.map((key) => (
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
