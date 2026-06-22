import { Badge, Divider, Group, HoverCard, Stack, Text } from "@mantine/core";
import {
    IconAlertOctagon,
    IconAlertTriangle,
    IconCheck,
    IconInfoCircle,
    IconProps
} from "@tabler/icons-react";
import { ComponentType, ReactNode } from "react";
import {
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueSeverity,
    getMaxSeverity
} from "../../shared/build-checker";
import { GroupOut, InsertableOut } from "../../shared/api-models";
import { IconSize } from "../common/style-constants";
import { RequireAccessLevel } from "../api-utils/access-level";
import {
    getGroupStateRows,
    getInsertableBuildIssues,
    getInsertableStateRows,
    StateRow,
    useGroupBuildIssues
} from "./build-status-hooks";

export type { StateRow };

interface SeverityVisual {
    icon: ComponentType<IconProps>;
    /** Mantine color name. */
    color: string;
    label: string;
}

/** Maps a severity (or `null` = all checks pass) to its icon, color, and label. */
function getSeverityVisual(
    severity: BuildIssueSeverity | null
): SeverityVisual {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return { icon: IconAlertOctagon, color: "red", label: "Error" };
        case BuildIssueSeverity.WARNING:
            return {
                icon: IconAlertTriangle,
                color: "yellow",
                label: "Warning"
            };
        case BuildIssueSeverity.INFO:
            return { icon: IconInfoCircle, color: "blue", label: "Info" };
        case null:
            return {
                icon: IconCheck,
                color: "green",
                label: "All checks pass"
            };
    }
}

interface BuildStatusCardProps {
    issues: BuildIssue[];
    /** Read-only "current state" rows shown above the build issues. */
    stateRows: StateRow[];
}

/** The hover-card dropdown content: state rows + divider + build issues. */
export function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { issues, stateRows } = props;
    return (
        <Stack gap="xs" maw={280}>
            <CurrentStateSection rows={stateRows} />
            <Divider />
            <BuildIssuesSection issues={issues} />
        </Stack>
    );
}

interface BuildStatusBadgeProps {
    issues: BuildIssue[];
    /** Read-only "current state" rows shown above the build issues. */
    stateRows: StateRow[];
}

/**
 * An inline tag summarizing the build-checker state for a group or insertable,
 * with a read-only hover card showing the current state and any build issues.
 * Only visible to editors and admins.
 */
export function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
    const { issues, stateRows } = props;
    const maxSeverity = getMaxSeverity(issues);
    const visual = getSeverityVisual(maxSeverity);
    const BadgeIcon = visual.icon;

    return (
        <RequireAccessLevel>
            <HoverCard
                withinPortal
                shadow="md"
                openDelay={150}
                closeDelay={50}
                position="right"
                withArrow
                arrowSize={20}
            >
                <HoverCard.Target>
                    <Badge
                        color={visual.color}
                        circle
                        leftSection={<BadgeIcon size={IconSize.TINY} />}
                        size="md"
                    >
                        Build status
                    </Badge>
                </HoverCard.Target>
                <HoverCard.Dropdown p="sm">
                    <BuildStatusCard issues={issues} stateRows={stateRows} />
                </HoverCard.Dropdown>
            </HoverCard>
        </RequireAccessLevel>
    );
}

/** Build-status badge pre-wired for an insertable. */
export function InsertableStatusBadge({
    insertable
}: {
    insertable: InsertableOut;
}): ReactNode {
    return (
        <BuildStatusBadge
            issues={getInsertableBuildIssues(insertable)}
            stateRows={getInsertableStateRows(insertable)}
        />
    );
}

/** Build-status badge pre-wired for a group (includes live visibility check). */
export function GroupStatusBadge({ group }: { group: GroupOut }): ReactNode {
    const issues = useGroupBuildIssues(group);
    return (
        <BuildStatusBadge
            issues={issues}
            stateRows={getGroupStateRows(group)}
        />
    );
}

function CurrentStateSection({ rows }: { rows: StateRow[] }): ReactNode {
    return (
        <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">
                Current state
            </Text>
            {rows.map((row) => (
                <Group key={row.label} gap="xs" justify="space-between">
                    <Text size="sm">{row.label}</Text>
                    <Text size="sm" fw={500}>
                        {row.value}
                    </Text>
                </Group>
            ))}
        </Stack>
    );
}

/** The human-readable message for a build issue, rendered at display time. */
function getIssueMessage(issue: BuildIssue): string {
    switch (issue.type) {
        case BuildIssueType.ThumbnailFailed:
            return "The thumbnail failed to generate.";
        case BuildIssueType.NoThumbnailTab:
            return "No thumbnail tab is set.";
        case BuildIssueType.NoVendors:
            return "No vendors could be parsed.";
        case BuildIssueType.NoUnhiddenInsertables:
            return "This group has no unhidden insertables.";
    }
}

function BuildIssuesSection({ issues }: { issues: BuildIssue[] }): ReactNode {
    if (issues.length === 0) {
        const visual = getSeverityVisual(null);
        const CheckIcon = visual.icon;
        return (
            <Group gap="xs" wrap="nowrap">
                <CheckIcon
                    size={IconSize.SMALL}
                    color={`var(--mantine-color-${visual.color}-6)`}
                />
                <Text size="sm">{visual.label}</Text>
            </Group>
        );
    }

    return (
        <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">
                Build checks
            </Text>
            {issues.map((issue) => {
                const visual = getSeverityVisual(getIssueSeverity(issue));
                const IssueIcon = visual.icon;
                return (
                    <Group
                        key={issue.type}
                        gap="xs"
                        wrap="nowrap"
                        align="start"
                    >
                        <IssueIcon
                            size={IconSize.SMALL}
                            color={`var(--mantine-color-${visual.color}-6)`}
                            style={{ flexShrink: 0, marginTop: 2 }}
                        />
                        <Text size="sm">{getIssueMessage(issue)}</Text>
                    </Group>
                );
            })}
        </Stack>
    );
}
