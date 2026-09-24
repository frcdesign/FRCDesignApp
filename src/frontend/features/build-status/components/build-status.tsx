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
import { useBuildStatusQuery } from "../queries";
import { useIsGroupLoading } from "../../library/queries";
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
    /** The group it is, or is in: a load of that group is what spins. */
    groupId: string;
    issues: BuildIssue[];
    /** When Onshape cut the version it is pinned to (epoch ms); null if none. */
    versionCreatedAt?: number;
    /** Set for an insertable, so an issue can open the configuration it blames. */
    configurationTarget?: ConfigurationTarget;
    /** Draws the badge as hidden-from-users instead of as its worst severity. */
    isHidden?: boolean;
}

interface BuildStatusCardProps extends BuildStatusSubject {
    /** The group/insertable admin menu wrapped by the card. */
    children: ReactNode;
}

function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const {
        name,
        groupId,
        issues,
        versionCreatedAt,
        configurationTarget,
        children
    } = props;
    return (
        <Stack gap="sm" w={300}>
            <CardHeader
                name={name}
                groupId={groupId}
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

/** Gated first, so the card and its admin controls only exist for an editor. */
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
    groupId,
    issues,
    versionCreatedAt,
    configurationTarget,
    isHidden,
    hoverMenu
}: BuildStatusHoverCardProps): ReactNode {
    const maxSeverity = getMaxSeverity(issues);
    const loading = useIsGroupLoading(groupId);

    return (
        <AppHoverCard
            position="right"
            arrowSize={20}
            target={
                loading ? (
                    <Loader size={IconSize.SMALL} />
                ) : isHidden ? (
                    // Only editors see hidden insertables, so its checks don't matter yet.
                    <AppIcon icon={EyeSlashIcon} color={StatusColor.WARNING} />
                ) : (
                    <IssueIcon severity={maxSeverity} />
                )
            }
        >
            <BuildStatusCard
                name={name}
                groupId={groupId}
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
    groupId: string;
    issues: BuildIssue[];
    versionCreatedAt?: number;
}

/** The card header: name + severity summary on the left, the version's age on the right. */
function CardHeader(props: CardHeaderProps): ReactNode {
    const { name, groupId, issues, versionCreatedAt } = props;
    return (
        <Stack gap={6}>
            <Group justify="space-between" align="center" gap="sm">
                <Text
                    truncate
                    title={name}
                    fw={FontWeight.SEMI_BOLD}
                    flex={1}
                    miw={0}
                >
                    {name}
                </Text>
                <VersionAge
                    groupId={groupId}
                    versionCreatedAt={versionCreatedAt}
                />
            </Group>
            <SeverityBadges issues={issues} />
        </Stack>
    );
}

interface VersionAgeProps {
    groupId: string;
    versionCreatedAt?: number;
}

/** When the pinned version was cut, not when it was synced. */
function VersionAge(props: VersionAgeProps): ReactNode {
    const { groupId, versionCreatedAt } = props;
    const loading = useIsGroupLoading(groupId);
    if (loading) {
        return (
            <Tooltip label="Being loaded from Onshape in the background">
                <Loader size="xs" className={styles.noShrink} />
            </Tooltip>
        );
    }
    return (
        <Group
            gap={4}
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
    groupId: string;
    name: string;
}

/** Build-status badge pre-wired for an insertable. */
export function InsertableStatusBadge(
    props: InsertableStatusBadgeProps
): ReactNode {
    const { insertableId, groupId, name } = props;
    const { data } = useBuildStatusQuery();
    const insertable = data?.insertables[insertableId];
    if (!insertable) return null;
    return (
        <BuildStatusBadge
            name={name}
            groupId={groupId}
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
            groupId={groupId}
            issues={issues}
            versionCreatedAt={groupStatus.versionCreatedAt}
            hoverMenu={
                <GroupAdminSection groupId={groupId} status={groupStatus} />
            }
        />
    );
}
