import {
    Badge,
    Box,
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
    Check,
    Clock,
    FileX,
    Info,
    Warning,
    WarningOctagon,
    X
} from "@phosphor-icons/react";
import {
    ComponentPropsWithRef,
    ReactNode,
    createContext,
    use,
    useCallback,
    useMemo,
    useState
} from "react";
import { formatRelativeTime } from "../../../lib/format-time";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueDescription,
    getIssueSeverity,
    getMaxSeverity,
    hasBuildIssue
} from "@backend/features/build-checker/issues";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import { getVendorName, Vendor } from "@backend/features/library/vendors";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    ConfigurationParameter,
    ParameterType
} from "@backend/features/configurations/models";
import {
    AUTO_INDEX_THRESHOLD,
    type ConfigurationCount,
    countCombinations,
    countConfigurations,
    IndexingBand,
    MAX_COUNTED_CONFIGURATIONS,
    MAX_PART_NUMBER_CONFIGURATIONS
} from "@backend/features/configurations/combinations";
import { FontWeight, IconSize } from "../../../lib/style-constants";
import { RequireAccessLevel } from "../../auth/access-level";
import { useBuildStatusQuery } from "../queries";
import { useJobStatusQuery } from "../../library/queries";
import {
    useSetVisibilityMutation,
    useToggleInsertAndFastenMutation,
    useIndexConfigurationsMutation,
    useToggleSortOrderMutation
} from "../../library/card-hooks";

/** Discriminated so `StateValue` renders each kind its own way. */
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
 * Stored issues plus the live "no unhidden insertables" check, which needs the
 * per-insertable visibility in the same response.
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
        // A group that never loaded has no insertables to unhide, so the failure
        // is the whole story.
        if (
            hasUnhidden ||
            hasBuildIssue(groupStatus.buildIssues, BuildIssueType.LOAD_FAILED)
        ) {
            return groupStatus.buildIssues;
        }
        return addBuildIssue(groupStatus.buildIssues, {
            type: BuildIssueType.NO_UNHIDDEN_INSERTABLES
        });
    }, [groupStatus, insertableStatuses]);
}

interface IssueIconProps
    // Rendered through Box, which owns these two as style props.
    extends Omit<ComponentPropsWithRef<"svg">, "color" | "display"> {
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
                <Box
                    component={WarningOctagon}
                    ref={ref}
                    size={IconSize.SMALL}
                    c="red"
                    {...others}
                />
            );
        case BuildIssueSeverity.WARNING:
            return (
                <Box
                    component={Warning}
                    ref={ref}
                    size={IconSize.SMALL}
                    c="yellow"
                    {...others}
                />
            );
        case BuildIssueSeverity.INFO:
            return (
                <Box
                    component={Info}
                    ref={ref}
                    size={IconSize.SMALL}
                    c="blue"
                    {...others}
                />
            );
        case null:
            return (
                <Box
                    component={Check}
                    ref={ref}
                    size={IconSize.SMALL}
                    c="green"
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
 * For controls that open a modal: `HoverCard` closes on mouse-leave, which never
 * fires when an overlay covers the dropdown, stranding it behind.
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
                <Clock size={IconSize.TINY} />
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
                leftSection={<Check size={IconSize.TINY} />}
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
                <InsertableHoverMenu
                    insertableId={insertableId}
                    status={insertable}
                />
            }
        />
    );
}

/** Enumerates configurations once, for every row of the card that needs it. */
function InsertableHoverMenu({
    insertableId,
    status
}: {
    insertableId: string;
    status: InsertableBuildStatus;
}): ReactNode {
    const configurationCount = useConfigurationCount(status);
    return (
        <>
            <InsertableAdminSection
                insertableId={insertableId}
                status={status}
                configurationCount={configurationCount}
            />
            <InsertableParsedSection status={status} />
            <ConfigurationSection
                parameters={status.configuration?.parameters}
            />
        </>
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
    status,
    configurationCount
}: {
    insertableId: string;
    status: InsertableBuildStatus;
    configurationCount: ConfigurationCount;
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
            <IndexingRow
                insertableId={insertableId}
                status={status}
                band={configurationCount.band}
            />
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
    status,
    band
}: {
    insertableId: string;
    status: InsertableBuildStatus;
    band: IndexingBand;
}): ReactNode {
    const mutation = useIndexConfigurationsMutation(insertableId);

    let control: ReactNode;
    if (status.elementType === ElementType.ASSEMBLY) {
        control = (
            <IndexingIcon
                severity={null}
                tooltip="This part is an assembly, so metadata is pulled directly from the assembly tab."
            />
        );
    } else if (band === IndexingBand.EXCEEDED) {
        control = (
            <IndexingIcon
                severity={BuildIssueSeverity.ERROR}
                tooltip={`Parts with more than ${MAX_PART_NUMBER_CONFIGURATIONS} configurations are not eligible for indexing. To resolve, exclude configurations from affecting part properties in Onshape.`}
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
                checked={status.indexConfigurations}
                onChange={() => mutation.mutate(!status.indexConfigurations)}
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
 * Enumerated rather than stored: the same shared routine the load path uses,
 * and it only runs when a hover card opens.
 */
function useConfigurationCount(
    status: InsertableBuildStatus
): ConfigurationCount {
    const parameters = status.configuration?.parameters;
    return useMemo(() => countConfigurations(parameters ?? []), [parameters]);
}

/** The true total, which runs past the index cap the band is decided by. */
function useDisplayedConfigurationCount(
    status: InsertableBuildStatus
): number | null {
    const parameters = status.configuration?.parameters;
    return useMemo(() => countCombinations(parameters ?? []), [parameters]);
}

/** Open-ended only past the counting cap, which nothing real reaches. */
function configurationCountValue(count: number | null): StateRowValue {
    if (count === null) {
        return {
            kind: "text",
            text: `Over ${MAX_COUNTED_CONFIGURATIONS.toLocaleString()}`
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
    const count = useDisplayedConfigurationCount(status);
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

/** Each parameter's name, the type it takes, and whether indexing varies it. */
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
                                    <ExcludedFromPropertiesIcon
                                        parameter={parameter}
                                    />
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

/**
 * Onshape's "exclude from affecting configured properties", the lever on the
 * count. Part studios only, which Onshape itself enforces.
 */
function ExcludedFromPropertiesIcon({
    parameter
}: {
    parameter: ConfigurationParameter;
}): ReactNode {
    if (!parameter.isCosmetic) {
        return null;
    }
    return (
        <Tooltip
            label="Excluded from affecting part properties in Onshape"
            multiline
            maw={260}
            withArrow
            events={{ hover: true, focus: true, touch: true }}
        >
            <Box
                component={FileX}
                size={IconSize.SMALL}
                c="dimmed"
                style={{ flexShrink: 0 }}
            />
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
            <Box component={Check} size={IconSize.SMALL} c="green" />
        ) : (
            <Box component={X} size={IconSize.SMALL} c="red" />
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
