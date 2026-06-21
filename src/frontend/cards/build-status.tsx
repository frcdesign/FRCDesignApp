import { Badge, Divider, Group, HoverCard, Stack, Text } from "@mantine/core";
import {
    IconAlertOctagon,
    IconAlertTriangle,
    IconCircleCheck,
    IconInfoCircle,
    IconProps
} from "@tabler/icons-react";
import { ComponentType, ReactNode, useMemo } from "react";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueSeverity,
    getMaxSeverity
} from "../../shared/build-checker";
import { GroupOut, InsertableOut } from "../../shared/api-models";
import { ElementType, getVendorName } from "../../shared/types";
import { IconSize } from "../common/style-constants";
import { RequireAccessLevel } from "../api-utils/access-level";
import { useLibraryQuery } from "../queries";

/** A single label/value row shown in the "current state" section. */
export interface StateRow {
    label: string;
    value: ReactNode;
}

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
                icon: IconCircleCheck,
                color: "green",
                label: "All checks pass"
            };
    }
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
                        variant="light"
                        circle
                        title={visual.label}
                    >
                        <BadgeIcon size={IconSize.TINY} />
                    </Badge>
                </HoverCard.Target>
                <HoverCard.Dropdown p="sm">
                    <Stack gap="xs" maw={280}>
                        <CurrentStateSection rows={stateRows} />
                        <Divider />
                        <BuildIssuesSection issues={issues} />
                    </Stack>
                </HoverCard.Dropdown>
            </HoverCard>
        </RequireAccessLevel>
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
            return "No thumbnail tab is set, so the first tab is used as a fallback.";
        case BuildIssueType.NoVendors:
            return "No vendors were parsed for this element.";
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

const yesNo = (value: boolean): string => (value ? "Yes" : "No");

/** Builds the read-only "current state" rows shown for an insertable. */
export function getInsertableStateRows(insertable: InsertableOut): StateRow[] {
    const rows: StateRow[] = [
        { label: "Hidden", value: yesNo(!insertable.isVisible) }
    ];
    if (insertable.elementType === ElementType.PART_STUDIO) {
        rows.push({
            label: "Open composite",
            value: yesNo(insertable.isOpenComposite)
        });
    }
    rows.push({
        label: "Insert and fasten",
        value: yesNo(insertable.supportsFasten)
    });
    rows.push({
        label: "Vendors",
        value:
            insertable.vendors.length > 0
                ? insertable.vendors.map(getVendorName).join(", ")
                : "None"
    });
    return rows;
}

/** Builds the read-only "current state" rows shown for a group. */
export function getGroupStateRows(group: GroupOut): StateRow[] {
    return [
        {
            label: "Sort",
            value: group.sortAlphabetically ? "Alphabetical" : "Tab order"
        }
    ];
}

/**
 * Returns the build issues for an insertable. Currently just the stored
 * build-time issues; a thin accessor so live checks can be added later.
 */
export function getInsertableBuildIssues(
    insertable: InsertableOut
): BuildIssue[] {
    return insertable.buildIssues;
}

/**
 * Returns the build issues for a group, combining stored build-time issues with
 * the live "no unhidden insertables" check (computed here since visibility is
 * user-dependent).
 */
export function useGroupBuildIssues(group: GroupOut): BuildIssue[] {
    const insertables = useLibraryQuery().data?.insertables;
    return useMemo(() => {
        const hasUnhidden = group.insertableOrder.some(
            (id) => insertables?.[id]?.isVisible
        );
        if (hasUnhidden) {
            return group.buildIssues;
        }
        return addBuildIssue(group.buildIssues, {
            type: BuildIssueType.NoUnhiddenInsertables
        });
    }, [group.buildIssues, group.insertableOrder, insertables]);
}
