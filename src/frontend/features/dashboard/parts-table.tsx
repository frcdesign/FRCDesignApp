import { Anchor, Badge, Group, Table, Text } from "@mantine/core";
import { ArrowSquareOut, CaretDown, CaretUp } from "@phosphor-icons/react";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
    SPARKLINE_DAYS,
    type PartUsageOut
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { makeUrl } from "../../lib/url";
import { IconSize } from "../../lib/style-constants";
import { formatCount } from "./series-utils";
import {
    DEFAULT_SORT,
    filterAndSort,
    nextSort,
    type SortColumn,
    type SortState
} from "./parts-sort";

const MiniSparkline = lazy(() =>
    import("./sparkline").then((module) => ({
        default: module.MiniSparkline
    }))
);

/** Small enough to sit in a row without stretching it. */
const ROW_SPARKLINE = { h: 24, w: 80 };

/**
 * Widths for every column but the first, which takes what is left.
 *
 * Without them the browser hands the two text columns all the slack and strands
 * the numbers, the sparkline and the link far apart from each other.
 */
const COLUMN_WIDTH = {
    group: 180,
    // Wide enough that the two longest headings stay on one line.
    usesPerMonth: 150,
    uses: 100,
    sparkline: 130,
    onshape: 90
} as const;

interface PartsTableProps {
    libraryId: LibraryId;
    parts: PartUsageOut[];
    /** Shown in place of the table when there is nothing to list. */
    emptyMessage: string;
    /** Filters on part and group name; every part when absent or empty. */
    search?: string;
}

export function PartsTable({
    libraryId,
    parts,
    emptyMessage,
    search = ""
}: PartsTableProps): ReactNode {
    const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

    const shown = useMemo(
        () => filterAndSort(parts, search, sort),
        [parts, search, sort]
    );

    function toggle(column: SortColumn): void {
        setSort((prev) => nextSort(prev, column));
    }

    if (shown.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                {search.trim() === "" ? emptyMessage : "No matching part."}
            </Text>
        );
    }

    return (
        <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <SortableTh
                            label="Part"
                            column="name"
                            sort={sort}
                            onToggle={toggle}
                        />
                        <SortableTh
                            label="Group"
                            column="groupName"
                            sort={sort}
                            onToggle={toggle}
                            width={COLUMN_WIDTH.group}
                        />
                        <SortableTh
                            label="Uses per month"
                            column="usesPerMonth"
                            sort={sort}
                            onToggle={toggle}
                            align="right"
                            width={COLUMN_WIDTH.usesPerMonth}
                        />
                        {/* Not "total": this is the selected window's count. */}
                        <SortableTh
                            label="Uses"
                            column="insertCount"
                            sort={sort}
                            onToggle={toggle}
                            align="right"
                            width={COLUMN_WIDTH.uses}
                        />
                        <Table.Th w={COLUMN_WIDTH.sparkline}>
                            Last {SPARKLINE_DAYS} days
                        </Table.Th>
                        <Table.Th w={COLUMN_WIDTH.onshape} ta="center">
                            Onshape
                        </Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {shown.map((part) => (
                        <PartRow
                            key={part.elementId}
                            libraryId={libraryId}
                            part={part}
                        />
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    );
}

function SortableTh({
    label,
    column,
    sort,
    onToggle,
    align,
    width
}: {
    label: string;
    column: SortColumn;
    sort: SortState;
    onToggle: (column: SortColumn) => void;
    align?: "right";
    /** Left off the first column, which absorbs the leftover width. */
    width?: number;
}): ReactNode {
    const active = sort.column === column;
    const Caret = sort.descending ? CaretDown : CaretUp;

    return (
        <Table.Th
            w={width}
            ta={align}
            onClick={() => onToggle(column)}
            style={{ cursor: "pointer", userSelect: "none" }}
        >
            <Group
                gap={4}
                wrap="nowrap"
                justify={align === "right" ? "flex-end" : undefined}
            >
                {label}
                {/* Reserved even when inactive, so the header never reflows. */}
                <Caret
                    size={IconSize.TINY}
                    opacity={active ? 1 : 0}
                    weight="bold"
                />
            </Group>
        </Table.Th>
    );
}

function PartRow({
    libraryId,
    part
}: {
    libraryId: LibraryId;
    part: PartUsageOut;
}): ReactNode {
    const navigate = useNavigate();

    return (
        <Table.Tr
            style={{ cursor: "pointer" }}
            onClick={() =>
                void navigate({
                    to: "/dashboard/library/$libraryId/part",
                    params: { libraryId },
                    search: (prev) => ({ ...prev, element: part.elementId })
                })
            }
        >
            <Table.Td>
                <Group gap="xs">
                    {part.name}
                    {!part.isVisible && (
                        <Badge color="gray" size="sm">
                            Hidden
                        </Badge>
                    )}
                </Group>
            </Table.Td>
            <Table.Td>{part.groupName}</Table.Td>
            <Table.Td ta="right">{formatCount(part.usesPerMonth)}</Table.Td>
            <Table.Td ta="right" c="dimmed">
                {formatCount(part.insertCount)}
            </Table.Td>
            <Table.Td>
                <Suspense fallback={<div style={{ height: 24 }} />}>
                    <MiniSparkline data={part.recent} {...ROW_SPARKLINE} />
                </Suspense>
            </Table.Td>
            {/* Stops the row's own navigation: this link leaves the app. */}
            <Table.Td ta="center" onClick={(event) => event.stopPropagation()}>
                <Anchor
                    href={makeUrl({
                        documentId: part.documentId,
                        instanceId: part.versionId,
                        instanceType: "v",
                        elementId: part.elementId
                    })}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${part.name} in Onshape`}
                >
                    <ArrowSquareOut size={IconSize.SMALL} />
                </Anchor>
            </Table.Td>
        </Table.Tr>
    );
}
