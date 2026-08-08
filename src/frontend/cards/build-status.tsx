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
    /** The group/insertable name shown in the header. */
    name: string;
    issues: BuildIssue[];
    /** When the entity was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
    /** The group/insertable admin menu wrapped by the card. */
    children: ReactNode;
}

/**
 * The hover-card content: a header (name, severity summary, last-loaded time),
 * the build checks (when any), and the wrapped group/insertable admin menu.
 */
function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { name, issues, lastLoadedAt, children } = props;
    return (
        <Stack gap="sm" w={300}>
            <CardHeader
                name={name}
                issues={issues}
                lastLoadedAt={lastLoadedAt}
            />
            {issues.length > 0 && (
                <>
                    <Divider />
                    <BuildChecksSection issues={issues} />
                </>
            )}
            <Divider />
            {children}
        </Stack>
    );
}

interface BuildStatusBadgeProps {
    /** The group/insertable name shown in the header. */
    name: string;
    issues: BuildIssue[];
    /** When the entity was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
    /** The group/insertable admin menu shown in the hover card. */
    hoverMenu: ReactNode;
}

/**
 * A severity icon whose hover card shows the build-status card wrapping the
 * given admin menu. Only rendered for editors and admins.
 */
export function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
    const { name, issues, lastLoadedAt, hoverMenu } = props;
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
                <HoverCard.Dropdown p="md" onClick={(e) => e.stopPropagation()}>
                    <BuildStatusCard
                        name={name}
                        issues={issues}
                        lastLoadedAt={lastLoadedAt}
                    >
                        {hoverMenu}
                    </BuildStatusCard>
                </HoverCard.Dropdown>
            </HoverCard>
        </RequireAccessLevel>
    );
}

/** The card header: name + severity summary on the left, last-loaded on the right. */
function CardHeader({
    name,
    issues,
    lastLoadedAt
}: {
    name: string;
    issues: BuildIssue[];
    lastLoadedAt: number | null;
}): ReactNode {
    return (
        <Group
            justify="space-between"
            align="flex-start"
            wrap="nowrap"
            gap="sm"
        >
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={FontWeight.SEMI_BOLD} size="sm" lineClamp={2}>
                    {name}
                </Text>
                <SeverityBadges issues={issues} />
            </Stack>
            <Text
                size="xs"
                c="dimmed"
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
                {lastLoadedAt === null
                    ? "Never loaded"
                    : `Loaded ${formatRelativeTime(lastLoadedAt)}`}
            </Text>
        </Group>
    );
}

/** Pill badges summarizing the issue counts, or an "all clear" badge. */
function SeverityBadges({ issues }: { issues: BuildIssue[] }): ReactNode {
    if (issues.length === 0) {
        return (
            <Badge
                size="sm"
                variant="light"
                color="green"
                leftSection={<IconCheck size={IconSize.TINY} />}
            >
                All checks pass
            </Badge>
        );
    }

    const counts = countSeverities(issues);
    return (
        <Group gap={6} wrap="wrap">
            {counts.error > 0 && (
                <CountBadge color="red" count={counts.error} noun="error" />
            )}
            {counts.warning > 0 && (
                <CountBadge
                    color="yellow"
                    count={counts.warning}
                    noun="warning"
                />
            )}
            {counts.info > 0 && (
                <CountBadge color="blue" count={counts.info} noun="note" />
            )}
        </Group>
    );
}

interface CountBadgeProps {
    color: string;
    count: number;
    /**
     * error, warning, or info.
     */
    noun: string;
}

function CountBadge({ color, count, noun }: CountBadgeProps): ReactNode {
    const plural = count === 1 ? "" : "s";
    const text = `${count} ${noun}${plural}`;
    return (
        <Badge size="sm" variant="light" color={color}>
            {text}
        </Badge>
    );
}

function countSeverities(issues: BuildIssue[]): {
    error: number;
    warning: number;
    info: number;
} {
    const counts = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) {
        switch (getIssueSeverity(issue)) {
            case BuildIssueSeverity.ERROR:
                counts.error += 1;
                break;
            case BuildIssueSeverity.WARNING:
                counts.warning += 1;
                break;
            case BuildIssueSeverity.INFO:
                counts.info += 1;
                break;
        }
    }
    return counts;
}

/** The build checks: one tinted callout per issue. Rendered only when non-empty. */
function BuildChecksSection({ issues }: { issues: BuildIssue[] }): ReactNode {
    return (
        <Stack gap={6}>
            <SectionHeader>Build checks</SectionHeader>
            {issues.map((issue) => (
                <IssueCallout key={issue.type} issue={issue} />
            ))}
        </Stack>
    );
}

/** A single build issue rendered as a tinted callout box in its severity color. */
function IssueCallout({ issue }: { issue: BuildIssue }): ReactNode {
    const severity = getIssueSeverity(issue);
    return (
        <Group
            gap="xs"
            wrap="nowrap"
            align="flex-start"
            p="xs"
            style={{
                backgroundColor: severityBackground(severity),
                borderRadius: "var(--mantine-radius-sm)"
            }}
        >
            <IssueIcon severity={severity} style={{ flexShrink: 0 }} />
            <Text size="sm">{getIssueMessage(issue)}</Text>
        </Group>
    );
}

/** The light background tint for a build-issue callout. */
function severityBackground(severity: BuildIssueSeverity): string {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return "var(--mantine-color-red-light)";
        case BuildIssueSeverity.WARNING:
            return "var(--mantine-color-yellow-light)";
        case BuildIssueSeverity.INFO:
            return "var(--mantine-color-blue-light)";
    }
}

/** Build-status badge pre-wired for an insertable. */
export function InsertableStatusBadge({
    insertableId,
    name,
    elementType
}: {
    insertableId: string;
    name: string;
    elementType: ElementType;
}): ReactNode {
    const { data } = useBuildStatusQuery();
    const insertable = data?.insertables[insertableId];
    if (!insertable) return null;
    return (
        <BuildStatusBadge
            name={name}
            issues={getInsertableBuildIssues(insertable)}
            lastLoadedAt={insertable.lastLoadedAt}
            hoverMenu={
                <>
                    <InsertableAdminSection
                        insertableId={insertableId}
                        elementType={elementType}
                        status={insertable}
                    />
                    <InsertableParsedSection status={insertable} />
                </>
            }
        />
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
            name={groupName}
            issues={issues}
            lastLoadedAt={groupStatus.lastLoadedAt}
            hoverMenu={
                <GroupAdminSection
                    groupId={groupId}
                    groupName={groupName}
                    status={groupStatus}
                />
            }
        />
    );
}

/** A dimmed section header, e.g. "Admin" or "Parsed". */
function SectionHeader({ children }: { children: ReactNode }): ReactNode {
    return (
        <Text
            size="xs"
            fw={FontWeight.SEMI_BOLD}
            c="dimmed"
            tt="uppercase"
            style={{ letterSpacing: "0.03em" }}
        >
            {children}
        </Text>
    );
}

/** A label (+ description) and on/off Switch row for an editable admin flag. */
function SwitchRow(props: {
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
}): ReactNode {
    return (
        <Group justify="space-between" wrap="nowrap" gap="md" align="center">
            <div style={{ minWidth: 0 }}>
                <Text size="sm">{props.label}</Text>
                <Text size="xs" c="dimmed">
                    {props.description}
                </Text>
            </div>
            <Switch
                size="sm"
                checked={props.checked}
                onChange={props.onToggle}
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
        <Stack gap="sm">
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
    const { mutate } = useSetVisibilityMutation([insertableId], !isVisible);
    return (
        <SwitchRow
            label="Visible to users"
            description="Shown in the library list"
            checked={isVisible}
            onToggle={mutate}
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
            description="Allows mate-on-insert"
            checked={supportsFasten}
            onToggle={() => mutation.mutate(!supportsFasten)}
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
            description="Indexed by vendor part number"
            checked={searchPartNumbers}
            onToggle={() => mutation.mutate(!searchPartNumbers)}
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
            description="Inserts as an open composite"
            checked={isOpenComposite}
            onToggle={() => mutation.mutate()}
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
        <Stack gap="sm">
            <SectionHeader>Admin</SectionHeader>
            <SwitchRow
                label="Sort alphabetically"
                description="Order elements A–Z instead of by tab"
                checked={status.sortAlphabetically}
                onToggle={() => mutation.mutate()}
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
