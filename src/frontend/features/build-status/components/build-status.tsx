import {
    Divider,
    Group,
    HoverCard,
    Loader,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import { ClockIcon } from "@phosphor-icons/react";
import { ReactNode, createContext, use, useCallback, useState } from "react";
import { formatRelativeTime } from "../../../lib/format-time";
import {
    BuildIssue,
    getMaxSeverity
} from "@backend/features/build-checker/issues";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import {
    FontWeight,
    IconSize,
    NO_SHRINK,
    StatusColor
} from "../../../lib/style-constants";
import { RequireAccessLevel } from "../../auth/access-level";
import { useBuildStatusQuery } from "../queries";
import { useIsJobRunning } from "../../library/queries";
import {
    BuildChecksSection,
    IssueIcon,
    SeverityBadges,
    getInsertableBuildIssues,
    useGroupBuildIssues
} from "./issues";
import {
    ConfigurationSection,
    InsertableParsedSection,
    useConfigurationCount
} from "./parsed-section";
import { GroupAdminSection, InsertableAdminSection } from "./admin-section";

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
function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
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
    const jobRunning = useIsJobRunning();

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

interface CardHeaderProps {
    name: string;
    issues: BuildIssue[];
    lastLoadedAt: number | null;
}

/** The card header: name + severity summary on the left, last-loaded on the right. */
function CardHeader(props: CardHeaderProps): ReactNode {
    const { name, issues, lastLoadedAt } = props;
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
                    flex={1}
                    miw={0}
                >
                    {name}
                </Text>
                <LastModified lastLoadedAt={lastLoadedAt} />
            </Group>
            <SeverityBadges issues={issues} />
        </Stack>
    );
}

interface LastModifiedProps {
    lastLoadedAt: number | null;
}

/**
 * The last-modified time, or a spinner (with a tooltip) while a job is running.
 */
function LastModified(props: LastModifiedProps): ReactNode {
    const { lastLoadedAt } = props;
    const jobRunning = useIsJobRunning();
    if (jobRunning) {
        return (
            <Tooltip label="The library is being loaded from Onshape in the background">
                <Loader size="xs" style={NO_SHRINK} />
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
                c={StatusColor.DIMMED}
                style={{ whiteSpace: "nowrap", ...NO_SHRINK }}
            >
                <ClockIcon size={IconSize.TINY} />
                <Text size="xs">
                    {!lastLoadedAt
                        ? "Unknown"
                        : `Last modified ${formatRelativeTime(lastLoadedAt)}`}
                </Text>
            </Group>
        </Tooltip>
    );
}

interface InsertableStatusBadgeProps {
    insertableId: string;
    name: string;
}

/** Build-status badge pre-wired for an insertable. */
export function InsertableStatusBadge(
    props: InsertableStatusBadgeProps
): ReactNode {
    const { insertableId, name } = props;
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

interface InsertableHoverMenuProps {
    insertableId: string;
    status: InsertableBuildStatus;
}

/** Enumerates configurations once, for every row of the card that needs it. */
function InsertableHoverMenu(props: InsertableHoverMenuProps): ReactNode {
    const { insertableId, status } = props;
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

interface GroupStatusBadgeProps {
    groupId: string;
    groupName: string;
}

/** Build-status badge pre-wired for a group (includes live visibility check). */
export function GroupStatusBadge(props: GroupStatusBadgeProps): ReactNode {
    const { groupId, groupName } = props;
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
