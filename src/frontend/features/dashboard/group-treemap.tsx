import { Anchor, Breadcrumbs, Group, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import type { PartUsageOut } from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryColor } from "../../theme";
import { SectionCard } from "./section";
import { toGroupNodes, toPartNodes, type TreemapNode } from "./treemap-data";

const GroupTreemapChart = lazy(() =>
    import("./treemap-chart").then((module) => ({
        default: module.GroupTreemapChart
    }))
);

/** Tall enough that the smaller groups still get a readable tile. */
const CHART_HEIGHT = 360;

/**
 * Insertions by group, as area.
 *
 * Clicking a group zooms to the parts inside it, and clicking a part opens its
 * dashboard — the same click the parts table gives a row, one level deeper.
 */
export function GroupTreemap({
    libraryId,
    parts
}: {
    libraryId: LibraryId;
    parts: PartUsageOut[];
}): ReactNode {
    const navigate = useNavigate();
    const [selected, setSelected] = useState<string | null>(null);
    const color = getLibraryColor(libraryId);

    const partNodes = useMemo(
        () => (selected === null ? [] : toPartNodes(parts, selected, color)),
        [parts, selected, color]
    );
    // A range change can drop the group being viewed, so falling back to the
    // top level beats drawing an empty rectangle.
    const zoomed = selected !== null && partNodes.length > 0;
    const nodes = useMemo(
        () => (zoomed ? partNodes : toGroupNodes(parts, color)),
        [zoomed, partNodes, parts, color]
    );

    function select(node: TreemapNode): void {
        if (node.groupName !== undefined) {
            setSelected(node.groupName);
        } else if (node.elementId !== undefined) {
            void navigate({
                to: "/dashboard/library/$libraryId/part",
                params: { libraryId },
                search: (prev) => ({ ...prev, element: node.elementId })
            });
        }
    }

    return (
        <SectionCard title="Group breakdown">
            <Group justify="space-between" mt={-8} mb="md">
                <Breadcrumbs separator="›">
                    {zoomed ? (
                        [
                            <Anchor
                                key="all"
                                size="sm"
                                onClick={() => setSelected(null)}
                            >
                                All groups
                            </Anchor>,
                            <Text key="group" size="sm">
                                {selected}
                            </Text>
                        ]
                    ) : (
                        <Text size="sm" c="dimmed">
                            Click a group to zoom in
                        </Text>
                    )}
                </Breadcrumbs>
            </Group>
            {nodes.length === 0 ? (
                <Text c="dimmed" py="xl" ta="center">
                    No parts were inserted in this range.
                </Text>
            ) : (
                <Suspense fallback={<div style={{ height: CHART_HEIGHT }} />}>
                    <GroupTreemapChart
                        nodes={nodes}
                        h={CHART_HEIGHT}
                        onSelect={select}
                    />
                </Suspense>
            )}
        </SectionCard>
    );
}
