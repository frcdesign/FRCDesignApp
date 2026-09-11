import { Treemap, type TreemapData } from "@mantine/charts";
import { type ReactNode } from "react";
import { formatCount } from "./format";
import { type TreemapNode } from "./treemap-data";

// The charts' styles, imported where the charts are so they land in the same
// route chunk rather than the panel's bundle.
import "@mantine/charts/styles.layer.css";

interface AppTreemapProps {
    nodes: TreemapNode[];
    h: number;
    onSelect: (node: TreemapNode) => void;
}

export function AppTreemap({ nodes, h, onSelect }: AppTreemapProps): ReactNode {
    return (
        <Treemap
            // `TreemapData` is an open record, which no union satisfies
            // implicitly; the extra keys are exactly what we want carried.
            data={nodes as unknown as TreemapData[]}
            height={h}
            valueFormatter={formatCount}
            style={{ cursor: "pointer" }}
            treemapProps={{
                // Long enough to read as a zoom, short enough not to wait.
                animationDuration: 300,
                // Recharts types the node as an open record, so the keys the
                // data carried come back untyped rather than missing.
                onClick: (node) => onSelect(node as unknown as TreemapNode)
            }}
        />
    );
}
