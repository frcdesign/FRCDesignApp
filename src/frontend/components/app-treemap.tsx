import { Treemap, type TreemapData } from "@mantine/charts";
import { type ReactNode } from "react";

// Imported here so the styles load only with a chart.
import "@mantine/charts/styles.layer.css";

/** What every tile carries; its area is its share of the chart's `value`. */
export interface TreemapTile {
    name: string;
    value: number;
    color: string;
}

interface AppTreemapProps<T extends TreemapTile> {
    nodes: T[];
    h: number;
    valueFormatter: (value: number) => string;
    onSelect: (node: T) => void;
}

/** A click on a tile hands back the node it was drawn from. */
export function AppTreemap<T extends TreemapTile>({
    nodes,
    h,
    valueFormatter,
    onSelect
}: AppTreemapProps<T>): ReactNode {
    return (
        <Treemap
            // `TreemapData` is an open record, which no union satisfies implicitly.
            data={nodes as unknown as TreemapData[]}
            height={h}
            valueFormatter={valueFormatter}
            style={{ cursor: "pointer" }}
            treemapProps={{
                // Long enough to read as a zoom, short enough not to wait.
                animationDuration: 300,
                onClick: (node) => onSelect(node as unknown as T)
            }}
        />
    );
}
