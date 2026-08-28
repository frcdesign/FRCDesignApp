import { Treemap, type TreemapData } from "@mantine/charts";
import { type ReactNode } from "react";
import { formatCount } from "./series-utils";
import { type TreemapNode } from "./treemap-data";

// Kept in this lazily-loaded module so recharts and its styles stay out of the
// Onshape panel bundle entirely.
import "@mantine/charts/styles.layer.css";

export function GroupTreemapChart({
    nodes,
    h,
    onSelect
}: {
    nodes: TreemapNode[];
    h: number;
    onSelect: (node: TreemapNode) => void;
}): ReactNode {
    return (
        <Treemap
            // `TreemapData` is an open record and an interface never satisfies
            // one implicitly; the extra keys are exactly what we want carried.
            data={nodes as TreemapData[]}
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
