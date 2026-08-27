import { ActionIcon, Badge, Group, Menu, Table, Text } from "@mantine/core";
import {
    ArrowSquareOut,
    CaretDown,
    CaretUp,
    ChartLine,
    DotsThree
} from "@phosphor-icons/react";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DashboardLink } from "./dashboard-link";
import {
    SPARKLINE_DAYS,
    type PartUsageOut
} from "@backend/features/analytics/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { makeUrl, openUrlInNewTab } from "../../lib/url";
import { IconSize } from "../../lib/style-constants";
import { formatCount, formatDate } from "./series-utils";
import {
    DEFAULT_SORT,
    filterAndSort,
    nextSort,
    type SortColumn,
    type SortState
} from "./parts-sort";

const PartSparkline = lazy(() =>
    import("./parts-sparkline").then((module) => ({
        default: module.PartSparkline
    }))
);

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
                        />
                        <SortableTh
                            label="Uses per month"
                            column="usesPerMonth"
                            sort={sort}
                            onToggle={toggle}
                            align="right"
                        />
                        <SortableTh
                            label="Total uses"
                            column="insertCount"
                            sort={sort}
                            onToggle={toggle}
                            align="right"
                        />
                        <Table.Th>Last {SPARKLINE_DAYS} days</Table.Th>
                        <SortableTh
                            label="Last used"
                            column="lastInsertedAt"
                            sort={sort}
                            onToggle={toggle}
                        />
                        <Table.Th />
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
    align
}: {
    label: string;
    column: SortColumn;
    sort: SortState;
    onToggle: (column: SortColumn) => void;
    align?: "right";
}): ReactNode {
    const active = sort.column === column;
    const Caret = sort.descending ? CaretDown : CaretUp;

    return (
        <Table.Th
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
    return (
        <Table.Tr>
            <Table.Td>
                <Group gap="xs">
                    <DashboardLink
                        to="/dashboard/library/$libraryId/part"
                        params={{ libraryId }}
                        search={(prev) => ({
                            ...prev,
                            element: part.elementId
                        })}
                    >
                        {part.name}
                    </DashboardLink>
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
                    <PartSparkline recent={part.recent} />
                </Suspense>
            </Table.Td>
            <Table.Td>{formatDate(part.lastInsertedAt)}</Table.Td>
            <Table.Td>
                <RowMenu libraryId={libraryId} part={part} />
            </Table.Td>
        </Table.Tr>
    );
}

/** Per-row actions, so the table itself stays counts and names. */
function RowMenu({
    libraryId,
    part
}: {
    libraryId: LibraryId;
    part: PartUsageOut;
}): ReactNode {
    const navigate = useNavigate();

    return (
        <Menu position="bottom-end" withinPortal>
            <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                    <DotsThree size={IconSize.MEDIUM} weight="bold" />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item
                    leftSection={<ChartLine size={IconSize.SMALL} />}
                    onClick={() =>
                        void navigate({
                            to: "/dashboard/library/$libraryId/part",
                            params: { libraryId },
                            search: (prev) => ({
                                ...prev,
                                element: part.elementId
                            })
                        })
                    }
                >
                    Open usage report
                </Menu.Item>
                <Menu.Item
                    leftSection={<ArrowSquareOut size={IconSize.SMALL} />}
                    onClick={() =>
                        openUrlInNewTab(
                            makeUrl({
                                documentId: part.documentId,
                                instanceId: part.versionId,
                                instanceType: "v",
                                elementId: part.elementId
                            })
                        )
                    }
                >
                    Open in Onshape
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
}
