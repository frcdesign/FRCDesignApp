import { Sparkline } from "@mantine/charts";
import { type ReactNode } from "react";

// Kept in this lazily-loaded module so recharts and its styles stay out of the
// Onshape panel bundle entirely.
import "@mantine/charts/styles.layer.css";

const HEIGHT = 24;
const WIDTH = 80;

/** One row's usage shape. Flat rather than empty when a part is never used. */
export function PartSparkline({ recent }: { recent: number[] }): ReactNode {
    return (
        <Sparkline
            h={HEIGHT}
            w={WIDTH}
            data={recent}
            curveType="monotone"
            color="var(--mantine-primary-color-filled)"
            fillOpacity={0.15}
            strokeWidth={1.5}
            withGradient
        />
    );
}
