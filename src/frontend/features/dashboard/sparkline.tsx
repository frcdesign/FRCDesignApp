import { Sparkline } from "@mantine/charts";
import { type ReactNode } from "react";
import { PrimaryColor } from "../../lib/style-constants";

// Imported here so the styles land in the dashboard's chunk.
import "@mantine/charts/styles.layer.css";

interface AppSparklineProps {
    data: number[];
    h: number;
    /** Fills its container when omitted, which is what a card wants. */
    w?: number;
}

/** Flat at zero rather than absent, so a row never changes height. */
export function AppSparkline({ data, h, w }: AppSparklineProps): ReactNode {
    return (
        <Sparkline
            h={h}
            w={w}
            data={data}
            // Mantine's own default is blue, whatever the theme says.
            color={PrimaryColor.FILLED}
            curveType="monotone"
            fillOpacity={0.15}
            strokeWidth={1.5}
        />
    );
}
