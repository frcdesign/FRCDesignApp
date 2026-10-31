import { Badge, Divider, Group, Loader, Text, Tooltip } from "@mantine/core";
import {
    EyeSlashIcon,
    GitBranchIcon,
    HourglassIcon
} from "@phosphor-icons/react";
import { ReactNode } from "react";
import { formatShortTimeAgo } from "../../../lib/format-time";
import {
    BuildIssue,
    getMaxSeverity
} from "@backend/features/build-checker/issues";
import { InsertableBuildStatus } from "@backend/features/build-checker/contract";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { AppHoverBubble } from "../../../components/app-hover-bubble";
import { RequireAccessLevel } from "../../auth/components/require-access";
import { useBuildStatusQuery } from "../queries";
import { useIsGroupLoading } from "../../library/queries";
import {
    BuildChecksSection,
    type ConfigurationTarget,
    IssueIcon,
    SeverityBadges
} from "./issues";
import {
    ConfigurationSection,
    InsertableParsedSection
} from "./parsed-section";
import { GroupAdminSection, InsertableAdminSection } from "./admin-section";
import { IndexingSection } from "./indexing-section";
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

    const statusIcon = (size: IconSize) =>
        isHidden ? (
            // Only editors see hidden insertables, so its checks don't matter yet.
            <AppIcon
                icon={EyeSlashIcon}
                size={size}
                color={StatusColor.WARNING}
            />
        ) : (
            <IssueIcon severity={maxSeverity} size={size} raised={false} />
        );

    return (
        <AppHoverBubble
            interactive
            target={
                loading ? (
                    <Loader size={IconSize.SMALL} />
                ) : (
                    statusIcon(IconSize.SMALL)
                )
            }
            // The version's age spins while loading, so the title keeps the status.
            icon={statusIcon(IconSize.CONTROL)}
            title={name}
            rightSection={
                <VersionAge
                    groupId={groupId}
                    versionCreatedAt={versionCreatedAt}
                />
            }
            subtitle={<SeverityBadges issues={issues} />}
        >
            {issues.length > 0 && (
                <>
                    <BuildChecksSection
                        issues={issues}
                        configurationTarget={configurationTarget}
                    />
                    <Divider />
                </>
            )}
            {hoverMenu}
        </AppHoverBubble>
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
            <Tooltip label="Being loaded from Onshape in the background.">
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
                {versionCreatedAt
                    ? formatShortTimeAgo(versionCreatedAt)
                    : "Unknown"}
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

function InsertableHoverMenu(props: InsertableHoverMenuProps): ReactNode {
    const { insertableId, status } = props;
    return (
        <>
            <InsertableAdminSection
                insertableId={insertableId}
                status={status}
            />
            <IndexingSection insertableId={insertableId} status={status} />
            <InsertableParsedSection status={status} />
            <ConfigurationSection status={status} />
        </>
    );
}

interface GroupStatusBadgeProps {
    groupId: string;
    name: string;
}

/** Build-status badge pre-wired for a group. */
export function GroupStatusBadge(props: GroupStatusBadgeProps): ReactNode {
    const { groupId, name } = props;
    const { data } = useBuildStatusQuery();
    const groupStatus = data?.groups[groupId];
    return (
        <>
            {groupStatus && (
                <BuildStatusBadge
                    name={name}
                    groupId={groupId}
                    issues={groupStatus.buildIssues}
                    versionCreatedAt={groupStatus.versionCreatedAt}
                    hoverMenu={
                        <GroupAdminSection
                            groupId={groupId}
                            status={groupStatus}
                        />
                    }
                />
            )}
            {groupStatus?.isHeld && <AwaitingApprovalBadge groupId={groupId} />}
        </>
    );
}

interface AwaitingApprovalBadgeProps {
    groupId: string;
}

/** Hidden once the approved load starts. */
function AwaitingApprovalBadge(props: AwaitingApprovalBadgeProps): ReactNode {
    const isLoading = useIsGroupLoading(props.groupId);
    if (isLoading) return null;
    return (
        <Badge
            color={StatusColor.WARNING}
            leftSection={<HourglassIcon size={IconSize.TINY} />}
        >
            Awaiting approval
        </Badge>
    );
}
