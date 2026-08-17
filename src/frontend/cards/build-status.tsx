import {
    Badge,
    Divider,
    Group,
    HoverCard,
    Loader,
    ScrollArea,
    Stack,
    Switch,
    Text,
    Tooltip
} from "@mantine/core";
import {
    IconAlertOctagon,
    IconAlertTriangle,
    IconCheck,
    IconClock,
    IconInfoCircle,
    IconX
} from "@tabler/icons-react";
import {
    ComponentPropsWithRef,
    ReactNode,
    createContext,
    use,
    useCallback,
    useMemo,
    useState
} from "react";
import { formatRelativeTime } from "../common/format-time";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueDescription,
    getIssueSeverity,
    getMaxSeverity
} from "../../shared/build-issues";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "../../shared/api-models";
import { getVendorName, isCustomPart, Vendor } from "../../shared/types";
import {
    ConfigurationParameter,
    ParameterType
} from "../../shared/configuration-models";
import {
    AUTO_INDEX_THRESHOLD,
    type ConfigurationCount,
    countConfigurations,
    IndexingBand,
    isIndexedParameter,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "../../shared/configuration-combinations";
import { FontWeight, IconColor, IconSize } from "../common/style-constants";
import { RequireAccessLevel } from "../api-utils/access-level";
import { useBuildStatusQuery, useJobStatusQuery } from "../queries";
import {
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
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
    | { kind: "text"; text: string; dimmed?: boolean }
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
 * Dismisses the surrounding build-status hover card. Used by controls that open
 * a modal, since `HoverCard` only closes on mouse-leave — never fired when a
 * modal overlay simply covers the dropdown, leaving it stranded behind.
 */
const CloseCardContext = createContext<() => void>(() => undefined);

/** Dismisses the build-status hover card a control is rendered inside. */
export function useCloseBuildCard(): () => void {
    return use(CloseCardContext);
}

/**
 * A severity icon whose hover card shows the build-status card wrapping the
 * given admin menu. Only rendered for editors and admins.
 */
export function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
    // Gate first so the card and its admin controls only exist for editors.
    return (
        <RequireAccessLevel>
            <BuildStatusHoverCard {...props} />
        </RequireAccessLevel>
    );
}

function BuildStatusHoverCard({
    name,
    issues,
    lastLoadedAt,
    hoverMenu
}: BuildStatusBadgeProps): ReactNode {
    const maxSeverity = getMaxSeverity(issues);
    const jobRunning = useJobStatusQuery().data?.running ?? false;

    // Remounting is the only way to close an uncontrolled HoverCard on demand.
    const [cardKey, setCardKey] = useState(0);
    const close = useCallback(() => setCardKey((key) => key + 1), []);

    return (
        <CloseCardContext value={close}>
            <HoverCard
                key={cardKey}
                withinPortal
                shadow="md"
                position="right"
                withArrow
                arrowSize={20}
            >
                <HoverCard.Target>
                    {jobRunning ? (
                        <Loader size={IconSize.SMALL} />
                    ) : (
                        <IssueIcon severity={maxSeverity} />
                    )}
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
        </CloseCardContext>
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
        <Stack gap={6}>
            <Group
                justify="space-between"
                align="center"
                wrap="nowrap"
                gap="sm"
            >
                <Text
                    fw={FontWeight.SEMI_BOLD}
                    size="sm"
                    lineClamp={2}
                    style={{ flex: 1, minWidth: 0 }}
                >
                    {name}
                </Text>
                <LastModified lastLoadedAt={lastLoadedAt} />
            </Group>
            <SeverityBadges issues={issues} />
        </Stack>
    );
}

/**
 * The last-modified time, or a spinner (with a tooltip) while a job is running.
 */
function LastModified({
    lastLoadedAt
}: {
    lastLoadedAt: number | null;
}): ReactNode {
    const jobRunning = useJobStatusQuery().data?.running ?? false;
    if (jobRunning) {
        return (
            <Tooltip label="The library is being loaded from Onshape in the background">
                <Loader size="xs" style={{ flexShrink: 0 }} />
            </Tooltip>
        );
    }
    return (
        <Tooltip
            label="The last time changes were pulled from Onshape."
            withArrow
        >
            <Group
                gap={4}
                wrap="nowrap"
                c="dimmed"
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
                <IconClock size={IconSize.TINY} />
                <Text size="xs">
                    {!lastLoadedAt
                        ? "Unknown"
                        : `Last modified ${formatRelativeTime(lastLoadedAt)}`}
                </Text>
            </Group>
        </Tooltip>
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
                <CountBadge
                    severity={BuildIssueSeverity.ERROR}
                    count={counts.error}
                />
            )}
            {counts.warning > 0 && (
                <CountBadge
                    severity={BuildIssueSeverity.WARNING}
                    count={counts.warning}
                />
            )}
            {counts.info > 0 && (
                <CountBadge
                    severity={BuildIssueSeverity.INFO}
                    count={counts.info}
                />
            )}
        </Group>
    );
}

/** The badge color and singular noun for each severity. */
const SEVERITY_BADGE: Record<
    BuildIssueSeverity,
    { color: string; noun: string }
> = {
    [BuildIssueSeverity.ERROR]: { color: "red", noun: "error" },
    [BuildIssueSeverity.WARNING]: { color: "yellow", noun: "warning" },
    [BuildIssueSeverity.INFO]: { color: "blue", noun: "info" }
};

function CountBadge({
    severity,
    count
}: {
    severity: BuildIssueSeverity;
    count: number;
}): ReactNode {
    const { color, noun } = SEVERITY_BADGE[severity];
    // Don't pluralize info, e.g. "2 infos" reads wrong.
    const plural = severity !== BuildIssueSeverity.INFO && count > 1 ? "s" : "";
    return (
        <Badge size="sm" variant="light" color={color}>
            {`${count} ${noun}${plural}`}
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
            {/* Nudge the icon down so it aligns with the first line of text. */}
            <IssueIcon
                severity={severity}
                style={{ flexShrink: 0, marginTop: 2 }}
            />
            <Text size="sm">{getIssueDescription(issue)}</Text>
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
    name
}: {
    insertableId: string;
    name: string;
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
                        status={insertable}
                    />
                    <InsertableParsedSection status={insertable} />
                    <ConfigurationSection
                        parameters={insertable.configuration?.parameters}
                    />
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
                <GroupAdminSection groupId={groupId} status={groupStatus} />
            }
        />
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

/**
 * A label (+ description) and a right-aligned control. Usually a Switch, but a
 * setting that isn't the admin's to make shows an icon saying why instead.
 */
function ControlRow(props: {
    label: string;
    description?: string;
    control: ReactNode;
}): ReactNode {
    return (
        <Group justify="space-between" wrap="nowrap" gap="md" align="center">
            <div style={{ minWidth: 0 }}>
                <Text size="sm">{props.label}</Text>
                <Text size="xs" c="dimmed">
                    {props.description}
                </Text>
            </div>
            {props.control}
        </Group>
    );
}

/** A label (+ description) and on/off Switch row for an editable admin flag. */
function SwitchRow(props: {
    label: string;
    description?: string;
    checked: boolean;
    onToggle: () => void;
}): ReactNode {
    return (
        <ControlRow
            label={props.label}
            description={props.description}
            control={
                <Switch
                    size="sm"
                    checked={props.checked}
                    onChange={props.onToggle}
                    withThumbIndicator={false}
                />
            }
        />
    );
}

/** The editable admin toggles for an insertable. */
function InsertableAdminSection({
    insertableId,
    status
}: {
    insertableId: string;
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
            <IndexingRow insertableId={insertableId} status={status} />
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
    const mutation = useSetVisibilityMutation([insertableId], !isVisible);
    return (
        <SwitchRow
            label="Visible to users"
            checked={isVisible}
            onToggle={() => mutation.mutate()}
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

/**
 * A switch only where enabling indexing is the admin's call, an icon saying why
 * not otherwise — past the cap it can't run, under the threshold it already has.
 */
function IndexingRow({
    insertableId,
    status
}: {
    insertableId: string;
    status: InsertableBuildStatus;
}): ReactNode {
    const { band } = useConfigurationCount(status);
    const mutation = useTogglePartNumberSearchMutation(insertableId);

    let control: ReactNode;
    if (band === IndexingBand.EXCEEDED) {
        control = (
            <IndexingIcon
                severity={BuildIssueSeverity.ERROR}
                tooltip={`Over the ${MAX_PART_NUMBER_CONFIGURATIONS} configuration limit, so there is nothing to index. Exclude parameters from properties to bring the count down.`}
            />
        );
    } else if (isCustomPart(status.vendors)) {
        control = (
            <IndexingIcon
                severity={BuildIssueSeverity.WARNING}
                tooltip="Custom parts are team-made, so there is no vendor metadata to parse."
            />
        );
    } else if (band === IndexingBand.AUTOMATIC) {
        control = (
            <IndexingIcon
                severity={null}
                tooltip={`Indexed automatically: an insertable under ${AUTO_INDEX_THRESHOLD} configurations indexes on every load.`}
            />
        );
    } else {
        control = (
            <Switch
                size="sm"
                checked={status.forceIndex}
                onChange={() => mutation.mutate(!status.forceIndex)}
                withThumbIndicator={false}
            />
        );
    }

    return (
        <ControlRow
            label="Enable indexing"
            description="Index metadata for search"
            control={control}
        />
    );
}

/**
 * Stands in for the switch where there is nothing to toggle, reusing the
 * build-check icons so the state reads the same as the callouts above it.
 */
function IndexingIcon({
    severity,
    tooltip
}: {
    severity: BuildIssueSeverity | null;
    tooltip: string;
}): ReactNode {
    return (
        <Tooltip label={tooltip} withArrow multiline w={260}>
            <IssueIcon severity={severity} style={{ flexShrink: 0 }} />
        </Tooltip>
    );
}

/** The editable admin toggles for a group. */
function GroupAdminSection({
    groupId,
    status
}: {
    groupId: string;
    status: GroupBuildStatus;
}): ReactNode {
    const mutation = useToggleSortOrderMutation(groupId);
    return (
        <Stack gap="sm">
            <SectionHeader>Admin</SectionHeader>
            <SwitchRow
                label="Sort alphabetically"
                description="Order elements A-Z instead of by tab"
                checked={status.sortAlphabetically}
                onToggle={() => mutation.mutate(!status.sortAlphabetically)}
            />
        </Stack>
    );
}

/**
 * An insertable's configuration count and which indexing limit it falls under.
 * Enumerated here rather than stored: it's the same shared routine the load path
 * uses, capped at {@link MAX_PART_NUMBER_CONFIGURATIONS}, and only runs when a
 * hover card opens.
 */
function useConfigurationCount(
    status: InsertableBuildStatus
): ConfigurationCount {
    const parameters = status.configuration?.parameters;
    return useMemo(() => countConfigurations(parameters ?? []), [parameters]);
}

/**
 * Renders a configuration count: "None" for a non-configurable insertable,
 * matching how the vendors row reads when there are none, and an open-ended
 * label past the cap, where enumeration stops before reaching a total.
 */
function configurationCountValue(count: number | null): StateRowValue {
    if (count === null) {
        return {
            kind: "text",
            text: `Over ${MAX_PART_NUMBER_CONFIGURATIONS}`
        };
    }
    if (count === 0) {
        return { kind: "text", text: "None", dimmed: true };
    }
    return { kind: "text", text: count.toLocaleString() };
}

/** The read-only auto-detected facts for an insertable. */
function InsertableParsedSection({
    status
}: {
    status: InsertableBuildStatus;
}): ReactNode {
    const { count } = useConfigurationCount(status);
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
                    label="Configurations"
                    value={configurationCountValue(count)}
                />
            </Stack>
        </>
    );
}

/**
 * Lists the insertable's configuration parameters: each parameter's name, the
 * type it takes, and whether indexing varies it. Renders nothing when the
 * insertable has no parameters.
 */
function ConfigurationSection({
    parameters
}: {
    parameters?: ConfigurationParameter[];
}): ReactNode {
    if (!parameters || parameters.length === 0) return null;
    return (
        <>
            <Divider />
            <Stack gap={6}>
                <SectionHeader>Configurations</SectionHeader>
                <ScrollArea.Autosize mah={220} type="auto">
                    <Stack gap={4}>
                        {parameters.map((parameter) => (
                            <Group
                                key={parameter.id}
                                gap="xl"
                                wrap="nowrap"
                                justify="space-between"
                            >
                                <Text size="sm">{parameter.name}</Text>
                                <Group gap={4} wrap="nowrap">
                                    <IndexedBadge parameter={parameter} />
                                    <ParameterTypeBadge parameter={parameter} />
                                </Group>
                            </Group>
                        ))}
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
        </>
    );
}

/** Why a parameter is or isn't varied when indexing, shown on hover. */
function getIndexedDescription(parameter: ConfigurationParameter): string {
    if (isIndexedParameter(parameter)) {
        return "Varied when indexing part numbers, so it multiplies this insertable's configuration count.";
    }
    if (
        parameter.type === ParameterType.QUANTITY ||
        parameter.type === ParameterType.STRING
    ) {
        return "Quantity and text parameters are never varied — they stay at their Onshape default.";
    }
    return "Excluded from properties, so it stays at its default instead of multiplying the configuration count.";
}

/** Whether indexing varies this parameter — the lever on the configuration count. */
function IndexedBadge({
    parameter
}: {
    parameter: ConfigurationParameter;
}): ReactNode {
    const isIndexed = isIndexedParameter(parameter);
    return (
        <Tooltip
            label={getIndexedDescription(parameter)}
            multiline
            maw={260}
            withArrow
            events={{ hover: true, focus: true, touch: true }}
        >
            <Badge
                size="xs"
                variant="light"
                color={isIndexed ? "blue" : "gray"}
            >
                {isIndexed ? "Indexed" : "Not indexed"}
            </Badge>
        </Tooltip>
    );
}

/**
 * The parameter's type. An enum also carries its option count, and lists the
 * options on hover — the values that drive its share of the configuration count.
 */
function ParameterTypeBadge({
    parameter
}: {
    parameter: ConfigurationParameter;
}): ReactNode {
    const isEnum = parameter.type === ParameterType.ENUM;
    const label = isEnum
        ? `${getParameterTypeLabel(parameter.type)} (${parameter.options.length})`
        : getParameterTypeLabel(parameter.type);

    const badge = (
        <Badge size="xs" variant="light" color="gray">
            {label}
        </Badge>
    );
    if (!isEnum || parameter.options.length === 0) {
        return badge;
    }
    return (
        <Tooltip
            label={parameter.options.map((option) => option.name).join(", ")}
            multiline
            maw={260}
            withArrow
            events={{ hover: true, focus: true, touch: true }}
        >
            {badge}
        </Tooltip>
    );
}

/** The short label for a parameter's type, shown as a badge. */
function getParameterTypeLabel(type: ParameterType): string {
    switch (type) {
        case ParameterType.ENUM:
            return "Enum";
        case ParameterType.BOOLEAN:
            return "Boolean";
        case ParameterType.QUANTITY:
            return "Quantity";
        case ParameterType.STRING:
            return "Text";
    }
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

    if (value.kind === "text") {
        return (
            <Text size="sm" c={value.dimmed ? "dimmed" : undefined}>
                {value.text}
            </Text>
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
