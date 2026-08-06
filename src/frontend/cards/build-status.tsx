import { Badge, Divider, Group, HoverCard, Stack, Text } from "@mantine/core";
import {
    IconAlertOctagon,
    IconAlertTriangle,
    IconCheck,
    IconClock,
    IconInfoCircle,
    IconX
} from "@tabler/icons-react";
import { ComponentPropsWithRef, ReactNode, useMemo } from "react";
import { formatRelativeTime } from "../common/format-time";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueSeverity,
    getMaxSeverity
} from "../../shared/build-checker";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "../../shared/api-models";
import { getVendorName, Vendor } from "../../shared/types";
import { FontWeight, IconColor, IconSize } from "../common/style-constants";
import { RequireAccessLevel } from "../api-utils/access-level";
import { useBuildStatusQuery } from "../queries";

/**
 * The value of a "current state" row. A discriminated union so `StateValue` can
 * render each kind appropriately (a check/cross for booleans, badges for
 * vendors, plain text otherwise).
 */
export type StateRowValue =
    | { kind: "bool"; value: boolean }
    | { kind: "vendors"; vendors: Vendor[] }
    | { kind: "text"; text: string };

/** A single label/value row shown in the "current state" section. */
export interface StateRow {
    label: string;
    value: StateRowValue;
}

/** Builds the read-only "current state" rows shown for an insertable. */
function getInsertableStateRows(insertable: InsertableBuildStatus): StateRow[] {
    const rows: StateRow[] = [
        {
            label: "Visible to users",
            value: { kind: "bool", value: insertable.isVisible }
        }
    ];
    if (insertable.isOpenComposite !== undefined) {
        rows.push({
            label: "Open composite",
            value: { kind: "bool", value: insertable.isOpenComposite }
        });
    }
    rows.push({
        label: "Insert and fasten",
        value: { kind: "bool", value: insertable.supportsFasten }
    });
    rows.push({
        label: "Part number search",
        value: { kind: "bool", value: insertable.searchPartNumbers }
    });
    rows.push({
        label: "Vendors",
        value: { kind: "vendors", vendors: insertable.vendors }
    });
    rows.push({
        label: "Configurable",
        value: { kind: "bool", value: !!insertable.configuration }
    });
    return rows;
}

/** Builds the read-only "current state" rows shown for a group. */
function getGroupStateRows(groupStatus: GroupBuildStatus): StateRow[] {
    return [
        {
            label: "Default sort order",
            value: {
                kind: "text",
                text: groupStatus.sortAlphabetically
                    ? "Alphabetical"
                    : "Standard"
            }
        }
    ];
}

/**
 * Returns the build issues for an insertable, merging insertable-level and
 * configuration-level issues.
 */
function getInsertableBuildIssues(
    insertable: InsertableBuildStatus
): BuildIssue[] {
    const configIssues = insertable.configuration?.buildIssues ?? [];
    return [...insertable.buildIssues, ...configIssues];
}

/**
 * Returns the build issues for a group, combining stored build-time issues with
 * the live "no unhidden insertables" check (computed here since visibility is
 * per-insertable state in the same build-status response).
 */
function useGroupBuildIssues(
    groupStatus: GroupBuildStatus | undefined,
    insertableStatuses: Record<string, InsertableBuildStatus> | undefined
): BuildIssue[] {
    return useMemo(() => {
        if (!groupStatus) return [];
        const hasUnhidden = groupStatus.insertableOrder.some(
            (id) => insertableStatuses?.[id]?.isVisible
        );
        if (hasUnhidden) {
            return groupStatus.buildIssues;
        }
        return addBuildIssue(groupStatus.buildIssues, {
            type: BuildIssueType.NO_UNHIDDEN_INSERTABLES
        });
    }, [groupStatus, insertableStatuses]);
}

interface IssueIconProps extends ComponentPropsWithRef<"svg"> {
    /** The severity to render, or null if all checks pass. */
    severity: BuildIssueSeverity | null;
    /** @default IconSize.SMALL */
    size?: number;
}

/** Renders the icon for a build-issue severity in its severity color. */
export function IssueIcon({
    severity,
    ref,
    ...others
}: IssueIconProps): ReactNode {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return (
                <IconAlertOctagon
                    ref={ref}
                    size={IconSize.SMALL}
                    color={IconColor.RED}
                    {...others}
                />
            );
        case BuildIssueSeverity.WARNING:
            return (
                <IconAlertTriangle
                    ref={ref}
                    size={IconSize.SMALL}
                    color={IconColor.YELLOW}
                    {...others}
                />
            );
        case BuildIssueSeverity.INFO:
            return (
                <IconInfoCircle
                    ref={ref}
                    size={IconSize.SMALL}
                    color={IconColor.BLUE}
                    {...others}
                />
            );
        case null:
            return (
                <IconCheck
                    ref={ref}
                    size={IconSize.SMALL}
                    color={IconColor.GREEN}
                    {...others}
                />
            );
    }
}

interface BuildStatusCardProps {
    issues: BuildIssue[];
    /** Read-only "current state" rows shown above the build issues. */
    stateRows: StateRow[];
    /** When the entity was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
}

/** The hover-card dropdown content: last-loaded header + state rows + issues. */
export function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { issues, stateRows, lastLoadedAt } = props;
    // Size to content (capped) so short rows/messages don't wrap.
    return (
        <Stack gap="xs" w="max-content" maw={300}>
            <LastLoadedHeader lastLoadedAt={lastLoadedAt} />
            <CurrentStateSection rows={stateRows} />
            <Divider />
            <BuildIssuesSection issues={issues} />
        </Stack>
    );
}

/** The "Loaded 3h ago" line pinned to the top-right corner of the card. */
function LastLoadedHeader({
    lastLoadedAt
}: {
    lastLoadedAt: number | null;
}): ReactNode {
    return (
        <Group gap={4} wrap="nowrap" justify="flex-end" c="dimmed">
            <IconClock size={IconSize.SMALL} />
            <Text size="xs">
                {lastLoadedAt === null
                    ? "Never loaded"
                    : `Loaded ${formatRelativeTime(lastLoadedAt)}`}
            </Text>
        </Group>
    );
}

interface BuildStatusBadgeProps {
    issues: BuildIssue[];
    /** Read-only "current state" rows shown above the build issues. */
    stateRows: StateRow[];
    /** When the entity was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
}

/**
 * An inline tag summarizing the build-checker state for a group or insertable,
 * with a read-only hover card showing the last-loaded time, current state, and
 * any build issues. Only visible to editors and admins.
 */
export function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
    const { issues, stateRows, lastLoadedAt } = props;
    const maxSeverity = getMaxSeverity(issues);

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
                    <IssueIcon severity={maxSeverity} />
                </HoverCard.Target>
                <HoverCard.Dropdown p="sm">
                    <BuildStatusCard
                        issues={issues}
                        stateRows={stateRows}
                        lastLoadedAt={lastLoadedAt}
                    />
                </HoverCard.Dropdown>
            </HoverCard>
        </RequireAccessLevel>
    );
}

/** Build-status badge pre-wired for an insertable. */
export function InsertableStatusBadge({
    insertableId
}: {
    insertableId: string;
}): ReactNode {
    const { data } = useBuildStatusQuery();
    const insertable = data?.insertables[insertableId];
    if (!insertable) return null;
    return (
        <BuildStatusBadge
            issues={getInsertableBuildIssues(insertable)}
            stateRows={getInsertableStateRows(insertable)}
            lastLoadedAt={insertable.lastLoadedAt}
        />
    );
}

/** Build-status badge pre-wired for a group (includes live visibility check). */
export function GroupStatusBadge({ groupId }: { groupId: string }): ReactNode {
    const { data } = useBuildStatusQuery();
    const groupStatus = data?.groups[groupId];
    const issues = useGroupBuildIssues(groupStatus, data?.insertables);
    if (!groupStatus) return null;
    return (
        <BuildStatusBadge
            issues={issues}
            stateRows={getGroupStateRows(groupStatus)}
            lastLoadedAt={groupStatus.lastLoadedAt}
        />
    );
}

function CurrentStateSection({ rows }: { rows: StateRow[] }): ReactNode {
    return (
        <Stack gap={4}>
            <Text size="xs" fw={FontWeight.SEMI_BOLD} c="dimmed">
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
            <IconCheck size={IconSize.SMALL} color={IconColor.GREEN} />
        ) : (
            <IconX size={IconSize.SMALL} color={IconColor.RED} />
        );
    }

    if (value.kind === "text") {
        return <Text size="sm">{value.text}</Text>;
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
                    color="blue"
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
        case BuildIssueType.THUMBNAIL_FAILED:
            return "The thumbnail failed to generate.";
        case BuildIssueType.NO_THUMBNAIL_TAB:
            return "No thumbnail tab is set.";
        case BuildIssueType.NO_VENDORS:
            return "No vendors could be parsed.";
        case BuildIssueType.NO_UNHIDDEN_INSERTABLES:
            return "This group has no unhidden insertables.";
        case BuildIssueType.TOO_MANY_CONFIGURATIONS:
            return "Too many configurations to index part numbers.";
        case BuildIssueType.MULTIPLE_PARTS:
            return "This part studio has more than one part.";
        case BuildIssueType.INSERTABLES_FAILED:
            return "Some insertables failed to load.";
        case BuildIssueType.LOAD_FAILED:
            return "This insertable failed to load.";
    }
}

function BuildIssuesSection({ issues }: { issues: BuildIssue[] }): ReactNode {
    if (issues.length === 0) {
        return (
            <Stack gap={4}>
                <Text size="xs" fw={FontWeight.SEMI_BOLD} c="dimmed">
                    Build checks
                </Text>

                <Group gap="xs" wrap="nowrap">
                    <IssueIcon severity={null} />
                    <Text size="sm">All checks pass</Text>
                </Group>
            </Stack>
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
