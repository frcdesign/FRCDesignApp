import { Badge, Divider, Group, HoverCard, Stack, Text } from "@mantine/core";
import {
    IconAlertOctagon,
    IconAlertTriangle,
    IconCheck,
    IconInfoCircle,
    IconProps,
    IconX
} from "@tabler/icons-react";
import { ComponentType, createElement, ReactNode } from "react";
import {
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueSeverity,
    getMaxSeverity
} from "../../shared/build-checker";
import { GroupOut, InsertableOut } from "../../shared/api-models";
import { getVendorName } from "../../shared/types";
import { IconSize } from "../common/style-constants";
import { RequireAccessLevel } from "../api-utils/access-level";
import {
    getGroupStateRows,
    getInsertableBuildIssues,
    getInsertableStateRows,
    StateRow,
    StateRowValue,
    useGroupBuildIssues
} from "./build-status-hooks";

export type { StateRow };

interface SeverityMeta {
    icon: ComponentType<IconProps>;
    /** Mantine color name. */
    color: string;
    label: string;
}

/** Icon, color, and label for a severity (or `null` = all checks pass). */
function getSeverityMeta(severity: BuildIssueSeverity | null): SeverityMeta {
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

interface IssueIconProps {
    /** The severity to render, or `null` for the "all checks pass" check. */
    severity: BuildIssueSeverity | null;
    /** @default IconSize.SMALL */
    size?: number;
}

/** Renders the icon for a build-issue severity in its severity color. */
export function IssueIcon({
    severity,
    size = IconSize.SMALL
}: IssueIconProps): ReactNode {
    const meta = getSeverityMeta(severity);
    return createElement(meta.icon, {
        size,
        color: `var(--mantine-color-${meta.color}-6)`
    });
}

interface BuildStatusCardProps {
    issues: BuildIssue[];
    /** Read-only "current state" rows shown above the build issues. */
    stateRows: StateRow[];
}

/** The hover-card dropdown content: state rows + divider + build issues. */
export function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { issues, stateRows } = props;
    // Size to content (capped) so short rows/messages don't wrap.
    return (
        <Stack gap="xs" w="max-content" maw={360}>
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
    const { color, label } = getSeverityMeta(maxSeverity);

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
                    {/* flexShrink: 0 keeps the badge at its natural size inside
                        the flex CardTitle row instead of being squished/stretched. */}
                    <Badge
                        color={color}
                        variant="light"
                        circle
                        title={label}
                        style={{ flexShrink: 0 }}
                    >
                        <IssueIcon
                            severity={maxSeverity}
                            size={IconSize.TINY}
                        />
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
                <Group
                    key={row.label}
                    gap="xl"
                    wrap="nowrap"
                    justify="space-between"
                >
                    <Text size="sm">{row.label}</Text>
                    <StateValue value={row.value} />
                </Group>
            ))}
        </Stack>
    );
}

/** Renders a "current state" value: a check/cross for booleans, badges for vendors. */
function StateValue({ value }: { value: StateRowValue }): ReactNode {
    if (value.kind === "bool") {
        return value.value ? (
            <IconCheck
                size={IconSize.SMALL}
                color="var(--mantine-color-green-6)"
            />
        ) : (
            <IconX size={IconSize.SMALL} color="var(--mantine-color-gray-5)" />
        );
    }

    if (value.vendors.length === 0) {
        return (
            <Text size="sm" c="dimmed">
                None
            </Text>
        );
    }
    return (
        <Group gap={4} wrap="wrap" justify="flex-end">
            {value.vendors.map((vendor) => (
                <Badge
                    key={vendor}
                    size="sm"
                    variant="light"
                    color="gray"
                    title={getVendorName(vendor)}
                >
                    {vendor}
                </Badge>
            ))}
        </Group>
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
        return (
            <Group gap="xs" wrap="nowrap">
                <IssueIcon severity={null} />
                <Text size="sm">{getSeverityMeta(null).label}</Text>
            </Group>
        );
    }

    return (
        <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed">
                Build checks
            </Text>
            {issues.map((issue) => (
                <Group key={issue.type} gap="xs" wrap="nowrap">
                    <IssueIcon severity={getIssueSeverity(issue)} />
                    <Text size="sm">{getIssueMessage(issue)}</Text>
                </Group>
            ))}
        </Stack>
    );
}
