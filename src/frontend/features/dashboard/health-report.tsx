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

    const tiles = [
        {
            label: "Healthy",
            value: formatPercent(counts.healthyItems, total),
            hint: `${formatCount(counts.healthyItems)} of ${formatCount(total)} groups and parts are clean`,
            severity: null
        },
        {
            label: "Errors",
            value: formatCount(counts.errorItems),
            hint: "items whose worst issue is an error",
            severity: BuildIssueSeverity.ERROR
        },
        {
            label: "Warnings",
            value: formatCount(counts.warningItems),
            hint: "items whose worst issue is a warning",
            severity: BuildIssueSeverity.WARNING
        },
        {
            label: "Info",
            value: formatCount(counts.infoItems),
            hint: "items with only informational notes",
            severity: BuildIssueSeverity.INFO
        }
    ];

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {tiles.map((tile) => (
                <Card key={tile.label} withBorder padding="lg" radius="md">
                    <Group gap="xs">
                        <SeverityIcon severity={tile.severity} />
                        <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                            {tile.label}
                        </Text>
                    </Group>
                    <Title order={2}>{tile.value}</Title>
                    <Text size="xs" c="dimmed" mt={4}>
                        {tile.hint}
                    </Text>
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

/** Compact error/warning counts for the top-level libraries table. */
export function HealthSummary({
    health
}: {
    health: LibraryHealthCounts;
}): ReactNode {
    if (health.groupCount === 0 && health.insertableCount === 0) {
        // An empty library has nothing to be clean about.
        return (
            <Text size="sm" c="dimmed">
                —
            </Text>
        );
    }

    if (health.errorItems === 0 && health.warningItems === 0) {
        return (
            <Group gap={4} justify="flex-end">
                <SeverityIcon severity={null} />
                <Text size="sm" c="dimmed">
                    Clean
                </Text>
            </Group>
        );
    }

    return (
        <Group gap="xs" justify="flex-end">
            {health.errorItems > 0 && (
                <Group gap={4}>
                    <SeverityIcon severity={BuildIssueSeverity.ERROR} />
                    <Text size="sm">{formatCount(health.errorItems)}</Text>
                </Group>
            )}
            {health.warningItems > 0 && (
                <Group gap={4}>
                    <SeverityIcon severity={BuildIssueSeverity.WARNING} />
                    <Text size="sm">{formatCount(health.warningItems)}</Text>
                </Group>
            )}
        </Group>
    );
}
