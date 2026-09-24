import { Treemap, type TreemapData } from "@mantine/charts";
import { type ReactNode } from "react";
import { formatCount } from "./format";
import { type TreemapNode } from "./treemap-data";

// Imported here so the styles land in the dashboard's chunk.
import "@mantine/charts/styles.layer.css";

interface AppTreemapProps {
    nodes: TreemapNode[];
    h: number;
    onSelect: (node: TreemapNode) => void;
}

export function AppTreemap({ nodes, h, onSelect }: AppTreemapProps): ReactNode {
    return (
        <Treemap
            // `TreemapData` is an open record, which no union satisfies implicitly.
            data={nodes as unknown as TreemapData[]}
            height={h}
            valueFormatter={formatCount}
            style={{ cursor: "pointer" }}
            treemapProps={{
                // Long enough to read as a zoom, short enough not to wait.
                animationDuration: 300,
                onClick: (node) => onSelect(node as unknown as TreemapNode)
            }}
        />
    );
}
