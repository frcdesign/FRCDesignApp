import { Anchor, Breadcrumbs, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { SectionCard } from "./section";
import {
    toNodes,
    type TreemapNode,
    type TreemapPath,
    type UsagePart
} from "./treemap-data";

const UsageTreemapChart = lazy(() =>
    import("./treemap-chart").then((module) => ({
        default: module.UsageTreemapChart
    }))
);

/** Tall enough that the smaller slices still get a readable tile. */
const CHART_HEIGHT = 360;

/**
 * Insertions as area, drilled by clicking.
 *
 * Rooted at every library on the app dashboard and at one library on a library
 * page, so the same component covers both — `root` is the level the breadcrumb
 * cannot climb above.
 */
export function UsageTreemap({
    parts,
    root = {}
}: {
    parts: UsagePart[];
    /** The level this instance starts at and will not go above. */
    root?: TreemapPath;
}): ReactNode {
    const navigate = useNavigate();
    const [path, setPath] = useState<TreemapPath>(root);

    const nodes = useMemo(() => toNodes(parts, path), [parts, path]);

    function select(node: TreemapNode): void {
        if (node.elementId !== undefined && node.libraryId !== undefined) {
            void navigate({
                to: "/dashboard/library/$libraryId/part",
                params: { libraryId: node.libraryId },
                search: (prev) => ({ ...prev, element: node.elementId })
            });
        } else if (node.groupName !== undefined) {
            setPath({ ...path, groupName: node.groupName });
        } else if (node.libraryId !== undefined) {
            setPath({ libraryId: node.libraryId });
        }
    }

    return (
        <SectionCard title="Usage breakdown">
            <Crumbs root={root} path={path} onSelect={setPath} />
            {nodes.length === 0 ? (
                <Text c="dimmed" py="xl" ta="center">
                    Nothing was inserted in this range.
                </Text>
            ) : (
                <Suspense fallback={<div style={{ height: CHART_HEIGHT }} />}>
                    <UsageTreemapChart
                        nodes={nodes}
                        h={CHART_HEIGHT}
                        onSelect={select}
                    />
                </Suspense>
            )}
        </SectionCard>
    );
}

/** Every level above the current one, each clickable to climb back to it. */
function Crumbs({
    root,
    path,
    onSelect
}: {
    root: TreemapPath;
    path: TreemapPath;
    onSelect: (path: TreemapPath) => void;
}): ReactNode {
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

    return (
        <Breadcrumbs separator="›">
            {steps.map((step, index) =>
                index === steps.length - 1 ? (
                    <Text key={step.label} size="sm">
                        {step.label}
                    </Text>
                ) : (
                    <Anchor
                        key={step.label}
                        size="sm"
                        onClick={() => onSelect(step.to)}
                    >
                        {step.label}
                    </Anchor>
                )
            )}
        </Breadcrumbs>
    );
}

/** Narrows a library id for a page that is already scoped to one. */
export function libraryRoot(libraryId: LibraryId): TreemapPath {
    return { libraryId };
}
