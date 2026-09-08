import { Sparkline } from "@mantine/charts";
import { type ReactNode } from "react";
import { PrimaryColor } from "../../lib/style-constants";

// The charts' styles, imported where the charts are so they land in the same
// route chunk rather than the panel's bundle.
import "@mantine/charts/styles.layer.css";

export interface AppSparklineProps {
    data: number[];
    h: number;
    /** Fills its container when omitted, which is what a card wants. */
    w?: number;
}

/**
 * A shape, not a chart: no axes, nothing to read a value off. Flat rather than
 * absent at zero, so a row never changes height.
 */
export function AppSparkline({ data, h, w }: AppSparklineProps): ReactNode {
    return (
        <Sparkline
            h={h}
            w={w}
            data={data}
            // Mantine's own default is blue, whatever the theme says.
            color={PrimaryColor.FILLED}
            // The rest are departures from its defaults: a smooth curve, and a
            // fainter, thinner line, since this sits behind a number.
            curveType="monotone"
            fillOpacity={0.15}
            strokeWidth={1.5}
        />
    );
}
