import {
    Anchor,
    Badge,
    Card,
    Group,
    Progress,
    SimpleGrid,
    Stack,
    Table,
    Text,
    Title
} from "@mantine/core";
import {
    WarningOctagon,
    Warning,
    Check,
    ArrowSquareOut,
    Info
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type {
    HealthIssueCount,
    HealthItem,
    LibraryHealthCounts
} from "@backend/features/analytics/contract";
import {
    BuildIssueSeverity,
    getIssueDescription,
    type BuildIssueType
} from "@backend/features/build-checker/issues";
import { LibraryId } from "@backend/features/library/library-id";
import { getLibraryName } from "../library/library-path";
import { IconSize } from "../../lib/style-constants";
import { makeUrl } from "../../lib/url";
import { formatCount, formatDate, formatPercent } from "./series-utils";

/** Mirrors the panel's severity colors so the two views agree at a glance. */
function SeverityIcon({
    severity
}: {
    severity: BuildIssueSeverity | null;
}): ReactNode {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return (
                <WarningOctagon
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-red-6)"}
                />
            );
        case BuildIssueSeverity.WARNING:
            return (
                <Warning
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-yellow-6)"}
                />
            );
        case BuildIssueSeverity.INFO:
            return (
                <Info
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-blue-6)"}
                />
            );
        case null:
            return (
                <Check
                    size={IconSize.SMALL}
                    color={"var(--mantine-color-green-6)"}
                />
            );
    }
}

const SEVERITY_COLOR: Record<BuildIssueSeverity, string> = {
    [BuildIssueSeverity.ERROR]: "red",
    [BuildIssueSeverity.WARNING]: "yellow",
    [BuildIssueSeverity.INFO]: "blue"
};

/** Headline health of the library: how much of it is clean, and what isn't. */
export function HealthTiles({
    counts
}: {
    counts: LibraryHealthCounts;
}): ReactNode {
    const total = counts.groupCount + counts.insertableCount;

    // Info issues are counted in the breakdown below rather than given a tile:
    // a number nobody acts on does not deserve a quarter of the row.
    const tiles = [
        {
            label: "Parts",
            value: formatCount(counts.insertableCount),
            severity: undefined
        },
        {
            label: "Healthy",
            value: formatPercent(counts.healthyItems, total),
            severity: null
        },
        {
            label: "Errors",
            value: formatCount(counts.errorCount),
            severity: BuildIssueSeverity.ERROR
        },
        {
            label: "Warnings",
            value: formatCount(counts.warningCount),
            severity: BuildIssueSeverity.WARNING
        }
    ];

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {tiles.map((tile) => (
                <Card key={tile.label} withBorder padding="lg" radius="md">
                    <Group gap="xs">
                        {tile.severity !== undefined && (
                            <SeverityIcon severity={tile.severity} />
                        )}
                        <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                            {tile.label}
                        </Text>
                    </Group>
                    <Title order={2}>{tile.value}</Title>
                </Card>
            ))}
        </SimpleGrid>
    );
}

/** How often each kind of issue occurs, worst severity first. */
export function IssueBreakdown({
    issues
}: {
    issues: HealthIssueCount[];
}): ReactNode {
    if (issues.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                No build issues anywhere in this library.
            </Text>
        );
    }

    const worst = Math.max(...issues.map((issue) => issue.count));

    return (
        <Stack gap="xs">
            {issues.map((issue) => (
                <div key={issue.type}>
                    <Group justify="space-between" gap="xs" mb={4}>
                        <Group gap="xs">
                            <SeverityIcon severity={issue.severity} />
                            <Text size="sm">{issue.description}</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                            {formatCount(issue.count)}
                        </Text>
                    </Group>
                    <Progress
                        value={(issue.count / worst) * 100}
                        color={SEVERITY_COLOR[issue.severity]}
                        size="sm"
                    />
                </div>
            ))}
        </Stack>
    );
}

/** Every affected group and part, worst first. */
export function HealthItemsTable({
    items
}: {
    items: HealthItem[];
}): ReactNode {
    if (items.length === 0) {
        return (
            <Text c="dimmed" py="xl" ta="center">
                Nothing to fix — every group and part passed its checks.
            </Text>
        );
    }

    return (
        <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th w={40} />
                        <Table.Th>Item</Table.Th>
                        <Table.Th>Group</Table.Th>
                        <Table.Th>Issues</Table.Th>
                        <Table.Th>Last loaded</Table.Th>
                        <Table.Th>Onshape</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {items.map((item) => (
                        <Table.Tr key={`${item.kind}-${item.id}`}>
                            <Table.Td>
                                <SeverityIcon severity={item.severity} />
                            </Table.Td>
                            <Table.Td>
                                <Group gap="xs">
                                    <Text size="sm">{item.name}</Text>
                                    {item.kind === "group" && (
                                        <Badge size="xs" color="gray">
                                            Group
                                        </Badge>
                                    )}
                                </Group>
                            </Table.Td>
                            <Table.Td>{item.groupName ?? "—"}</Table.Td>
                            <Table.Td>
                                <Group gap={4}>
                                    {item.issues.map((type) => (
                                        <IssueBadge key={type} type={type} />
                                    ))}
                                </Group>
                            </Table.Td>
                            <Table.Td>
                                {item.lastLoadedAt === null ? (
                                    <Badge size="xs" color="red">
                                        Never
                                    </Badge>
                                ) : (
                                    formatDate(item.lastLoadedAt)
                                )}
                            </Table.Td>
                            <Table.Td>
                                <ItemLink item={item} />
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    );
}

function IssueBadge({ type }: { type: BuildIssueType }): ReactNode {
    return (
        <Badge size="xs" variant="light" color="gray">
            {getIssueDescription({ type })}
        </Badge>
    );
}

/** Groups are documents, so they link one level up from a part's tab. */
function ItemLink({ item }: { item: HealthItem }): ReactNode {
    if (!item.documentId || !item.versionId) return "—";

    const path = {
        documentId: item.documentId,
        instanceId: item.versionId,
        instanceType: "v" as const
    };
    // `makeUrl` is overloaded per path depth, so the branches stay separate.
    const url = item.elementId
        ? makeUrl({ ...path, elementId: item.elementId })
        : makeUrl(path);

    return (
        <Anchor href={url} target="_blank" rel="noreferrer">
            <ArrowSquareOut size={IconSize.SMALL} />
        </Anchor>
    );
}

/**
 * Every library's health at a glance, for the app dashboard.
 *
 * Kept apart from the usage table below it: health is current state and usage
 * is a window, and interleaving them made one row answer two questions.
 */
export function LibraryHealthStrip({
    libraries
}: {
    libraries: { libraryId: LibraryId; health: LibraryHealthCounts }[];
}): ReactNode {
    return (
        <Table>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Library</Table.Th>
                    <Table.Th ta="right">Parts</Table.Th>
                    <Table.Th ta="right">Healthy</Table.Th>
                    <Table.Th ta="right">Errors</Table.Th>
                    <Table.Th ta="right">Warnings</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {libraries.map(({ libraryId, health }) => (
                    <Table.Tr key={libraryId}>
                        <Table.Td>{getLibraryName(libraryId)}</Table.Td>
                        <Table.Td ta="right">
                            {formatCount(health.insertableCount)}
                        </Table.Td>
                        <Table.Td ta="right">
                            {formatPercent(
                                health.healthyItems,
                                health.groupCount + health.insertableCount
                            )}
                        </Table.Td>
                        <Table.Td ta="right">
                            {formatCount(health.errorCount)}
                        </Table.Td>
                        <Table.Td ta="right">
                            {formatCount(health.warningCount)}
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
}
