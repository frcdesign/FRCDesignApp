import { Text } from "@mantine/core";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { getLibraryName } from "../../lib/library";
import { AppTreemap } from "./treemap-chart";
import { AppBreadcrumbs } from "../../components/breadcrumbs";
import { SectionCard } from "../../components/section";
import {
    toNodes,
    TreemapKind,
    type TreemapNode,
    type TreemapPath
} from "./treemap-data";

interface UsageTreemapProps {
    parts: PartUsageOut[];
    /** The level this instance starts at and will not go above. */
    root?: TreemapPath;
}

/** Tall enough that the smaller slices still get a readable tile. */
const CHART_HEIGHT = 360;

/** `root` is the highest level the breadcrumb can climb to. */
export function UsageTreemap({
    parts,
    root = {}
}: UsageTreemapProps): ReactNode {
    const navigate = useNavigate();
    const [path, setPath] = useState<TreemapPath>(root);

    const nodes = useMemo(() => toNodes(parts, path), [parts, path]);

    const select = (node: TreemapNode): void => {
        switch (node.kind) {
            case TreemapKind.LIBRARY:
                return setPath({ libraryId: node.libraryId });
            case TreemapKind.GROUP:
                return setPath({ ...path, groupName: node.groupName });
            case TreemapKind.PART:
                // The only click that leaves the chart.
                return void navigate({
                    to: "/dashboard/library/$libraryId/part",
                    params: { libraryId: node.libraryId },
                    search: { element: node.elementId }
                });
        }
    };

    return (
        <SectionCard title="Usage breakdown">
            <TreemapTrail root={root} path={path} onSelect={setPath} />
            {nodes.length === 0 ? (
                <Text c="dimmed" py="xl" ta="center">
                    Nothing was inserted in this range.
                </Text>
            ) : (
                <AppTreemap nodes={nodes} h={CHART_HEIGHT} onSelect={select} />
            )}
        </SectionCard>
    );
}

interface TreemapTrailProps {
    root: TreemapPath;
    path: TreemapPath;
    onSelect: (path: TreemapPath) => void;
}

/** Every level above the current one, each clickable to climb back to it. */
function TreemapTrail({ root, path, onSelect }: TreemapTrailProps): ReactNode {
    const steps: { label: string; to: TreemapPath }[] = [];

    if (root.libraryId === undefined) {
        steps.push({ label: "All libraries", to: {} });
    }
    if (path.libraryId !== undefined) {
        steps.push({
            label: getLibraryName(path.libraryId),
            to: { libraryId: path.libraryId }
        });
    }
    if (path.groupName !== undefined) {
        steps.push({ label: path.groupName, to: path });
    }

    // Rooted at a library with nothing drilled, there is nowhere to go back to.
    if (steps.length <= 1) {
        return null;
    }

    const current = steps[steps.length - 1];
    return (
        // Spaced off the chart below, which otherwise sits on the trail.
        <AppBreadcrumbs
            mb="sm"
            crumbs={steps.slice(0, -1).map((step) => ({
                label: step.label,
                onClick: () => onSelect(step.to)
            }))}
            current={current.label}
        />
    );
}
