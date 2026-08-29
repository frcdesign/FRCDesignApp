import { Sparkline } from "@mantine/charts";
import { type ReactNode } from "react";

// Kept in this lazily-loaded module so recharts and its styles stay out of the
// Onshape panel bundle entirely.
import "@mantine/charts/styles.layer.css";

/**
 * A shape, not a chart: no axes, no tooltip, nothing to read a value off.
 *
 * Flat rather than absent when everything is zero, so a row or tile never
 * changes height depending on whether anything happened.
 */
export function MiniSparkline({
    data,
    h,
    w
}: {
    data: number[];
    h: number;
    /** Fills its container when omitted, which is what a card wants. */
    w?: number;
}): ReactNode {
    return (
        <Sparkline
            h={h}
            w={w}
            data={data}
            curveType="monotone"
            color="var(--mantine-primary-color-filled)"
            fillOpacity={0.15}
            strokeWidth={1.5}
            withGradient
        />
    );
}
