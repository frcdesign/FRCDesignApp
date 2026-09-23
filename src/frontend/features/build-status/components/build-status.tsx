import { Divider, Group, Loader, Stack, Text, Tooltip } from "@mantine/core";
import { EyeSlashIcon, GitBranchIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { formatDaysAgo } from "../../../lib/format-time";
import {
    BuildIssue,
    getMaxSeverity
} from "@backend/features/build-checker/issues";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { AppHoverCard } from "../../../components/app-hover-card";
import { RequireAccessLevel } from "../../auth/access-level";
import { TruncatedText } from "../../../components/truncated-text";
import { useBuildStatusQuery } from "../queries";
import { useIsJobRunning } from "../../library/queries";
import {
    BuildChecksSection,
    type ConfigurationTarget,
    IssueIcon,
    SeverityBadges,
    useGroupBuildIssues
} from "./issues";
import {
    ConfigurationSection,
    InsertableParsedSection,
    useConfigurationCount
} from "./parsed-section";
import { GroupAdminSection, InsertableAdminSection } from "./admin-section";
import styles from "../../../lib/styles.module.css";

/** What the card and the badge both say about a group or an insertable. */
interface BuildStatusSubject {
    /** The group/insertable name shown in the header. */
    name: string;
    issues: BuildIssue[];
    /** When Onshape cut the version it is pinned to (epoch ms); null if none. */
    versionCreatedAt: number | null;
    /** Set for an insertable, so an issue can open the configuration it blames. */
    configurationTarget?: ConfigurationTarget;
    /** Draws the badge as hidden-from-users instead of as its worst severity. */
    isHidden?: boolean;
}

interface BuildStatusCardProps extends BuildStatusSubject {
    /** The group/insertable admin menu wrapped by the card. */
    children: ReactNode;
}

/**
 * The hover-card content: a header (name, severity summary, last-loaded time),
 * the build checks (when any), and the wrapped group/insertable admin menu.
 */
function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { name, issues, versionCreatedAt, configurationTarget, children } =
        props;
    return (
        <Stack gap="sm" w={300}>
            <CardHeader
                name={name}
                issues={issues}
                versionCreatedAt={versionCreatedAt}
            />
            {issues.length > 0 && (
                <>
                    <Divider />
                    <BuildChecksSection
                        issues={issues}
                        configurationTarget={configurationTarget}
                    />
                </>
            )}
            <Divider />
            {children}
        </Stack>
    );
}

interface BuildStatusBadgeProps extends BuildStatusSubject {
    /** The group/insertable admin menu shown in the hover card. */
    hoverMenu: ReactNode;
}

/**
 * A severity icon whose hover card shows the build-status card wrapping the
 * given admin menu. Gated first, so the card and its admin controls only exist
 * for an editor.
 */
function BuildStatusBadge(props: BuildStatusBadgeProps): ReactNode {
    return (
        <RequireAccessLevel>
            <BuildStatusHoverCard {...props} />
        </RequireAccessLevel>
    );
}

/** The badge's own props, passed straight through once the gate allows it. */
type BuildStatusHoverCardProps = BuildStatusBadgeProps;

function BuildStatusHoverCard({
    name,
    issues,
    versionCreatedAt,
    configurationTarget,
    isHidden,
    hoverMenu
}: BuildStatusHoverCardProps): ReactNode {
    const maxSeverity = getMaxSeverity(issues);
    const jobRunning = useIsJobRunning();

    return (
        <AppHoverCard
            position="right"
            arrowSize={20}
            target={
                jobRunning ? (
                    <Loader size={IconSize.SMALL} />
                ) : isHidden ? (
                    // Nobody but an editor sees a hidden insertable, so what
                    // its checks say about it does not matter yet.
                    <AppIcon
                        icon={EyeSlashIcon}
                        color={StatusColor.WARNING}
                        label="Hidden"
                    />
                ) : (
                    <IssueIcon severity={maxSeverity} />
                )
            }
        >
            <BuildStatusCard
                name={name}
                issues={issues}
                versionCreatedAt={versionCreatedAt}
                configurationTarget={configurationTarget}
            >
                {hoverMenu}
            </BuildStatusCard>
        </AppHoverCard>
    );
}

interface CardHeaderProps {
    name: string;
    issues: BuildIssue[];
    versionCreatedAt: number | null;
}

/** The card header: name + severity summary on the left, the version's age on the right. */
function CardHeader(props: CardHeaderProps): ReactNode {
    const { name, issues, versionCreatedAt } = props;
    return (
        <Stack gap={6}>
            <Group
                justify="space-between"
                align="center"
                wrap="nowrap"
                gap="sm"
            >
                <TruncatedText
                    hoverText={name}
                    fw={FontWeight.SEMI_BOLD}
                    size="sm"
                    flex={1}
                    miw={0}
                >
                    {name}
                </TruncatedText>
                <VersionAge versionCreatedAt={versionCreatedAt} />
            </Group>
            <SeverityBadges issues={issues} />
        </Stack>
    );
}

interface VersionAgeProps {
    versionCreatedAt: number | null;
}

/**
 * How old the pinned Onshape version is — when the version was cut, not when we
 * last synced it. A spinner (with a tooltip) stands in while a job is running;
 * otherwise the version icon and a day count say it without a label.
 */
function VersionAge(props: VersionAgeProps): ReactNode {
    const { versionCreatedAt } = props;
    // Asked for again rather than threaded through three components; React
    // Query serves both readers from one cache entry.
    const jobRunning = useIsJobRunning();
    if (jobRunning) {
        return (
            <Tooltip label="The library is being loaded from Onshape in the background">
                <Loader size="xs" className={styles.noShrink} />
            </Tooltip>
        );
    }
    return (
        <Group
            gap={4}
            wrap="nowrap"
            c={StatusColor.DIMMED}
            className={styles.noShrink}
            style={{ whiteSpace: "nowrap" }}
        >
            <GitBranchIcon size={IconSize.TINY} />
            <Text size="xs">
                {versionCreatedAt ? formatDaysAgo(versionCreatedAt) : "Unknown"}
            </Text>
        </Group>
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
            issues={insertable.buildIssues}
            versionCreatedAt={insertable.versionCreatedAt}
            isHidden={!insertable.isVisible}
            configurationTarget={
                insertable.configuration && {
                    elementPath: insertable.elementPath,
                    parameters: insertable.configuration.parameters
                }
            }
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
            <ConfigurationSection insertableId={insertableId} status={status} />
        </>
    );
}

interface GroupStatusBadgeProps {
    groupId: string;
    name: string;
}

/** Build-status badge pre-wired for a group (includes live visibility check). */
export function GroupStatusBadge(props: GroupStatusBadgeProps): ReactNode {
    const { groupId, name } = props;
    const { data } = useBuildStatusQuery();
    const groupStatus = data?.groups[groupId];
    const issues = useGroupBuildIssues(groupStatus, data?.insertables);
    if (!groupStatus) return null;
    return (
        <BuildStatusBadge
            name={name}
            issues={issues}
            versionCreatedAt={groupStatus.versionCreatedAt}
            hoverMenu={
                <GroupAdminSection groupId={groupId} status={groupStatus} />
            }
        />
    );
}
