import { Treemap, type TreemapData } from "@mantine/charts";
import { useMantineTheme } from "@mantine/core";
import { type ReactNode } from "react";
import { type TreemapNode } from "recharts";
import { fitLabel } from "../lib/fit-label";

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
    const theme = useMantineTheme();
    const measure = textMeasurer(`${LABEL_FONT_SIZE}px ${theme.fontFamily}`);

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
                onClick: (node) => onSelect(node as unknown as T),
                content: (node: TreemapNode) => (
                    <TileContent
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        depth={node.depth}
                        name={node.name}
                        // The tile's own data, spread onto the node by recharts.
                        color={node.color as string | undefined}
                        measure={measure}
                    />
                )
            }}
        />
    );
}

const LABEL_FONT_SIZE = 12;
/** Space kept clear between a label and its tile's edges, each side. */
const LABEL_PADDING = 4;

const measurers = new Map<string, (text: string) => number>();

/** Measures text drawn in `font`; estimates from its length where there's no canvas, as in jsdom. */
function textMeasurer(font: string): (text: string) => number {
    const cached = measurers.get(font);
    if (cached) {
        return cached;
    }
    const context = document.createElement("canvas").getContext("2d");
    let measure: (text: string) => number;
    if (context) {
        context.font = font;
        measure = (text) => context.measureText(text).width;
    } else {
        measure = (text) => text.length * LABEL_FONT_SIZE * 0.6;
    }
    measurers.set(font, measure);
    return measure;
}

interface TileContentProps {
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    name: string;
    color?: string;
    measure: (text: string) => number;
}

/** Mantine's tile, with a label cut to fit or hidden. */
function TileContent({
    x,
    y,
    width,
    height,
    depth,
    name,
    color,
    measure
}: TileContentProps): ReactNode {
    // Depth 0 is the root, which spans the chart and draws nothing.
    if (depth < 1) {
        return <g />;
    }
    const label =
        height >= LABEL_FONT_SIZE + 2 * LABEL_PADDING
            ? fitLabel(name, width - 2 * LABEL_PADDING, measure)
            : undefined;
    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
                stroke="var(--chart-stroke-color, var(--mantine-color-body))"
                strokeWidth={1}
            />
            {label !== undefined && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--mantine-color-white)"
                    fontSize={LABEL_FONT_SIZE}
                    fontFamily="var(--mantine-font-family)"
                >
                    {label}
                </text>
            )}
        </g>
    );
}
