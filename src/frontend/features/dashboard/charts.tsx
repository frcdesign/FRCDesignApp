import { lazy, Suspense, type ReactNode } from "react";
import type { MiniSparklineProps } from "./sparkline";
import type {
    LibraryInsertsChartProps,
    MetricDetailChartProps
} from "./trend-chart";
import type { UsageTreemapChartProps } from "./treemap-chart";

/**
 * Every chart the dashboard draws, each behind its own code split: recharts and
 * its styles are the biggest thing the app imports and the Onshape panel never
 * draws one. Each holds its own Suspense, so a caller renders it like anything
 * else. Import the charts from here — reaching for the modules below directly
 * would pull recharts back into the main bundle.
 */

/** Sized like the chart it stands in for, so nothing reflows when it lands. */
function Placeholder({ h }: { h: number }): ReactNode {
    return <div style={{ height: h }} />;
}

const Sparkline = lazy(() =>
    import("./sparkline").then((module) => ({ default: module.MiniSparkline }))
);

export function MiniSparkline(props: MiniSparklineProps): ReactNode {
    return (
        <Suspense fallback={<Placeholder h={props.h} />}>
            <Sparkline {...props} />
        </Suspense>
    );
}

const DetailChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.MetricDetailChart
    }))
);

export function MetricDetailChart(props: MetricDetailChartProps): ReactNode {
    return (
        <Suspense fallback={<Placeholder h={props.h ?? DETAIL_HEIGHT} />}>
            <DetailChart {...props} />
        </Suspense>
    );
}

const InsertsChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.LibraryInsertsChart
    }))
);

export function LibraryInsertsChart(
    props: LibraryInsertsChartProps
): ReactNode {
    return (
        <Suspense fallback={<Placeholder h={props.h ?? DETAIL_HEIGHT} />}>
            <InsertsChart {...props} />
        </Suspense>
    );
}

const Treemap = lazy(() =>
    import("./treemap-chart").then((module) => ({
        default: module.UsageTreemapChart
    }))
);

export function UsageTreemapChart(props: UsageTreemapChartProps): ReactNode {
    return (
        <Suspense fallback={<Placeholder h={props.h} />}>
            <Treemap {...props} />
        </Suspense>
    );
}

/** The height both trend charts fall back to; duplicated from `trend-chart`
 * rather than imported, which would load it eagerly. */
const DETAIL_HEIGHT = 160;
