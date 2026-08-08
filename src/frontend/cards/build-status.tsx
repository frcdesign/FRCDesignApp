import {
    Badge,
    Divider,
    Group,
    HoverCard,
    Stack,
    Switch,
    Text
} from "@mantine/core";
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
import { ElementType, getVendorName, Vendor } from "../../shared/types";
import { FontWeight, IconColor, IconSize } from "../common/style-constants";
import { RequireAccessLevel } from "../api-utils/access-level";
import { useBuildStatusQuery } from "../queries";
import {
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
    useToggleOpenCompositeMutation,
    useTogglePartNumberSearchMutation,
    useToggleSortOrderMutation
} from "./card-hooks";

/**
 * The value of a read-only "parsed" row. A discriminated union so `StateValue`
 * can render each kind appropriately (a check/cross for booleans, badges for
 * vendors).
 */
export type StateRowValue =
    | { kind: "bool"; value: boolean }
    | { kind: "vendors"; vendors: Vendor[] };

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
    /** When the entity was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
    /** Entity-specific admin toggles + parsed info. */
    children: ReactNode;
}

/** The hover-card dropdown content: last-loaded header + build checks + admin/parsed. */
export function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { issues, lastLoadedAt, children } = props;
    // Size to content (capped) so short rows/messages don't wrap.
    return (
        <Stack gap="xs" w="max-content" miw={240} maw={320}>
            <LastLoadedHeader lastLoadedAt={lastLoadedAt} />
            <BuildIssuesSection issues={issues} />
            <Divider />
            {children}
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
    /** When the entity was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
    /** Entity-specific admin toggles + parsed info. */
    children: ReactNode;
}

/**
 * An inline tag summarizing the build-checker state for a group or insertable.
 */
export function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
    const { issues, lastLoadedAt, children } = props;
    const maxSeverity = getMaxSeverity(issues);

    return (
        <RequireAccessLevel>
            <HoverCard
                withinPortal
                shadow="md"
                position="right"
                withArrow
                arrowSize={20}
            >
                <HoverCard.Target>
                    <IssueIcon severity={maxSeverity} />
                </HoverCard.Target>
                <HoverCard.Dropdown p="sm" onClick={(e) => e.stopPropagation()}>
                    <BuildStatusCard
                        issues={issues}
                        lastLoadedAt={lastLoadedAt}
                    >
                        {children}
                    </BuildStatusCard>
                </HoverCard.Dropdown>
            </HoverCard>
        </RequireAccessLevel>
    );
}

/** Build-status badge pre-wired for an insertable. */
export function InsertableStatusBadge({
    insertableId,
    elementType
}: {
    insertableId: string;
    elementType: ElementType;
}): ReactNode {
    const { data } = useBuildStatusQuery();
    const insertable = data?.insertables[insertableId];
    if (!insertable) return null;
    return (
        <BuildStatusBadge
            issues={getInsertableBuildIssues(insertable)}
            lastLoadedAt={insertable.lastLoadedAt}
        >
            <InsertableAdminSection
                insertableId={insertableId}
                elementType={elementType}
                status={insertable}
            />
            <InsertableParsedSection status={insertable} />
        </BuildStatusBadge>
    );
}

/** Build-status badge pre-wired for a group (includes live visibility check). */
export function GroupStatusBadge({
    groupId,
    groupName
}: {
    groupId: string;
    groupName: string;
}): ReactNode {
    const { data } = useBuildStatusQuery();
    const groupStatus = data?.groups[groupId];
    const issues = useGroupBuildIssues(groupStatus, data?.insertables);
    if (!groupStatus) return null;
    return (
        <BuildStatusBadge
            issues={issues}
            lastLoadedAt={groupStatus.lastLoadedAt}
        >
            <GroupAdminSection
                groupId={groupId}
                groupName={groupName}
                status={groupStatus}
            />
        </BuildStatusBadge>
    );
}

/** A dimmed section header, e.g. "Admin" or "Parsed". */
function SectionHeader({ children }: { children: ReactNode }): ReactNode {
    return (
        <Text size="xs" fw={FontWeight.SEMI_BOLD} c="dimmed">
            {children}
        </Text>
    );
}

/** A label + on/off Switch row for an editable admin flag. */
function SwitchRow(props: {
    label: string;
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
}): ReactNode {
    return (
        <Group gap="xl" wrap="nowrap" justify="space-between">
            <Text size="sm">{props.label}</Text>
            <Switch
                size="sm"
                checked={props.checked}
                onChange={props.onToggle}
                disabled={props.disabled}
            />
        </Group>
    );
}

/** The editable admin toggles for an insertable. */
function InsertableAdminSection({
    insertableId,
    elementType,
    status
}: {
    insertableId: string;
    elementType: ElementType;
    status: InsertableBuildStatus;
}): ReactNode {
    return (
        <Stack gap={6}>
            <SectionHeader>Admin</SectionHeader>
            <VisibilitySwitch
                insertableId={insertableId}
                isVisible={status.isVisible}
            />
            <FastenSwitch
                insertableId={insertableId}
                supportsFasten={status.supportsFasten}
            />
            <PartNumberSwitch
                insertableId={insertableId}
                searchPartNumbers={status.searchPartNumbers}
            />
            {elementType === ElementType.PART_STUDIO && (
                <OpenCompositeSwitch
                    insertableId={insertableId}
                    isOpenComposite={status.isOpenComposite}
                />
            )}
        </Stack>
    );
}

function VisibilitySwitch({
    insertableId,
    isVisible
}: {
    insertableId: string;
    isVisible: boolean;
}): ReactNode {
    const { mutate, isPending } = useSetVisibilityMutation(
        [insertableId],
        !isVisible
    );
    return (
        <SwitchRow
            label="Visible to users"
            checked={isVisible}
            onToggle={mutate}
            disabled={isPending}
        />
    );
}

function FastenSwitch({
    insertableId,
    supportsFasten
}: {
    insertableId: string;
    supportsFasten: boolean;
}): ReactNode {
    const mutation = useToggleInsertAndFastenMutation(insertableId);
    return (
        <SwitchRow
            label="Insert and fasten"
            checked={supportsFasten}
            onToggle={() => mutation.mutate(!supportsFasten)}
            disabled={mutation.isPending}
        />
    );
}

function PartNumberSwitch({
    insertableId,
    searchPartNumbers
}: {
    insertableId: string;
    searchPartNumbers: boolean;
}): ReactNode {
    const mutation = useTogglePartNumberSearchMutation(insertableId);
    return (
        <SwitchRow
            label="Part number search"
            checked={searchPartNumbers}
            onToggle={() => mutation.mutate(!searchPartNumbers)}
            disabled={mutation.isPending}
        />
    );
}

function OpenCompositeSwitch({
    insertableId,
    isOpenComposite
}: {
    insertableId: string;
    isOpenComposite: boolean;
}): ReactNode {
    const mutation = useToggleOpenCompositeMutation(
        insertableId,
        isOpenComposite
    );
    return (
        <SwitchRow
            label="Open composite"
            checked={isOpenComposite}
            onToggle={() => mutation.mutate()}
            disabled={mutation.isPending}
        />
    );
}

/** The editable admin toggles for a group. */
function GroupAdminSection({
    groupId,
    groupName,
    status
}: {
    groupId: string;
    groupName: string;
    status: GroupBuildStatus;
}): ReactNode {
    const mutation = useToggleSortOrderMutation(
        groupId,
        groupName,
        status.sortAlphabetically
    );
    return (
        <Stack gap={6}>
            <SectionHeader>Admin</SectionHeader>
            <SwitchRow
                label="Sort alphabetically"
                checked={status.sortAlphabetically}
                onToggle={() => mutation.mutate()}
                disabled={mutation.isPending}
            />
        </Stack>
    );
}

/** The read-only auto-detected facts for an insertable. */
function InsertableParsedSection({
    status
}: {
    status: InsertableBuildStatus;
}): ReactNode {
    return (
        <>
            <Divider />
            <Stack gap={6}>
                <SectionHeader>Parsed</SectionHeader>
                <ParsedRow
                    label="Vendors"
                    value={{ kind: "vendors", vendors: status.vendors }}
                />
                <ParsedRow
                    label="Configurable"
                    value={{ kind: "bool", value: !!status.configuration }}
                />
            </Stack>
        </>
    );
}

/** A read-only label/value row in the "Parsed" section. */
function ParsedRow({
    label,
    value
}: {
    label: string;
    value: StateRowValue;
}): ReactNode {
    return (
        <Group gap="xl" wrap="nowrap" justify="space-between">
            <Text size="sm">{label}</Text>
            <StateValue value={value} />
        </Group>
    );
}

/** Renders a parsed value: a check/cross for booleans, badges for vendors. */
function StateValue({ value }: { value: StateRowValue }): ReactNode {
    if (value.kind === "bool") {
        return value.value ? (
            <IconCheck size={IconSize.SMALL} color={IconColor.GREEN} />
        ) : (
            <IconX size={IconSize.SMALL} color={IconColor.RED} />
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
