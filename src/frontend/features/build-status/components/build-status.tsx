import {
    Badge,
    Group,
    Image,
    Loader,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import {
    EyeSlashIcon,
    GitBranchIcon,
    HourglassIcon
} from "@phosphor-icons/react";
import { ReactNode } from "react";
import partStudioIcon from "/part-studio.svg";
import assemblyIcon from "/assembly.svg";
import { formatShortTimeAgo } from "../../../lib/format-time";
import {
    BuildIssue,
    getMaxSeverity
} from "@backend/features/build-checker/issues";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { AppHoverCard } from "../../../components/app-hover-card";
import { RequireAccessLevel } from "../../auth/components/require-access";
import { useBuildStatusQuery } from "../queries";
import { useIsGroupLoading } from "../../library/queries";
import {
    BuildIssueList,
    type ConfigurationTarget,
    IssueIcon,
    SeverityBadges
} from "./issues";
import { ConfigurationSection } from "./configuration-section";
import { GroupSettings, InsertableSettings } from "./admin-section";
import { UsageSection } from "./usage-section";
import { CardSection } from "./card-section";
import { DotIndicator } from "../../../components/dot-indicator";
import { useHasIndexingDraft } from "../indexing-draft";
import { SectionId } from "../../../lib/ui-state";
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
    /** Named in the header; a group has none. */
    elementType?: ElementType;
}

interface BuildStatusCardProps extends BuildStatusSubject {
    /** The sections under the build checks. */
    children: ReactNode;
}

/** Wide enough for a parameter's name beside its type and checkbox. */
const CARD_WIDTH = 320;

function BuildStatusCard(props: BuildStatusCardProps): ReactNode {
    const { children, ...subject } = props;
    const { issues, configurationTarget } = subject;
    return (
        <Stack gap="sm" w={CARD_WIDTH}>
            <CardHeader {...subject} />
            {issues.length > 0 && (
                <CardSection id={SectionId.BUILD_CHECKS} title="Build checks">
                    <BuildIssueList
                        issues={issues}
                        configurationTarget={configurationTarget}
                    />
                </CardSection>
            )}
            {children}
        </Stack>
    );
}

interface BuildStatusBadgeProps extends BuildStatusSubject {
    /** The group/insertable sections shown in the hover card. */
    sections: ReactNode;
    /** Dots the badge: the card holds edits not yet saved. */
    hasUnsavedEdits?: boolean;
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
    sections,
    elementType,
    hasUnsavedEdits = false
}: BuildStatusHoverCardProps): ReactNode {
    const maxSeverity = getMaxSeverity(issues);
    const loading = useIsGroupLoading(groupId);

    return (
        <AppHoverCard
            position="right"
            arrowSize={20}
            interactive
            target={
                <DotIndicator shown={hasUnsavedEdits} offset={2}>
                    {loading ? (
                        <Loader size={IconSize.SMALL} />
                    ) : isHidden ? (
                        // Only editors see hidden insertables, so its checks don't matter yet.
                        <AppIcon
                            icon={EyeSlashIcon}
                            color={StatusColor.WARNING}
                        />
                    ) : (
                        <IssueIcon severity={maxSeverity} raised={false} />
                    )}
                </DotIndicator>
            }
        >
            <BuildStatusCard
                name={name}
                groupId={groupId}
                issues={issues}
                versionCreatedAt={versionCreatedAt}
                configurationTarget={configurationTarget}
                elementType={elementType}
            >
                {sections}
            </BuildStatusCard>
        </AppHoverCard>
    );
}

interface CardHeaderProps {
    name: string;
    groupId: string;
    issues: BuildIssue[];
    versionCreatedAt?: number;
    elementType?: ElementType;
}

/** Onshape's own tab icons, which its users already know the two by. */
const ELEMENT_TYPES: Record<ElementType, { label: string; icon: string }> = {
    [ElementType.PART_STUDIO]: { label: "Part studio", icon: partStudioIcon },
    [ElementType.ASSEMBLY]: { label: "Assembly", icon: assemblyIcon }
};

/** What it is and its name above, the severity summary below. */
function CardHeader(props: CardHeaderProps): ReactNode {
    const { name, groupId, issues, versionCreatedAt, elementType } = props;
    return (
        <Stack gap={6}>
            <Group justify="space-between" align="center" gap="sm">
                <Group gap={6} flex={1} miw={0}>
                    {elementType && (
                        <ElementTypeIcon elementType={elementType} />
                    )}
                    <Text
                        truncate
                        title={name}
                        fw={FontWeight.SEMI_BOLD}
                        miw={0}
                    >
                        {name}
                    </Text>
                </Group>
                <VersionAge
                    groupId={groupId}
                    versionCreatedAt={versionCreatedAt}
                />
            </Group>
            <SeverityBadges issues={issues} />
        </Stack>
    );
}

interface ElementTypeIconProps {
    elementType: ElementType;
}

function ElementTypeIcon(props: ElementTypeIconProps): ReactNode {
    const { elementType } = props;
    return (
        <Tooltip label={ELEMENT_TYPES[elementType].label}>
            <Image
                src={ELEMENT_TYPES[elementType].icon}
                w={IconSize.SMALL}
                h={IconSize.SMALL}
                className={styles.noShrink}
            />
        </Tooltip>
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
    const hasUnsavedEdits = useHasIndexingDraft(insertableId);
    const insertable = data?.insertables[insertableId];
    if (!insertable) return null;
    return (
        <BuildStatusBadge
            hasUnsavedEdits={hasUnsavedEdits}
            name={name}
            groupId={groupId}
            issues={insertable.buildIssues}
            versionCreatedAt={insertable.versionCreatedAt}
            isHidden={!insertable.isVisible}
            elementType={insertable.elementType}
            configurationTarget={
                insertable.configuration && {
                    elementPath: insertable.elementPath,
                    parameters: insertable.configuration.parameters
                }
            }
            sections={
                <>
                    <CardSection id={SectionId.SETTINGS} title="Settings">
                        <InsertableSettings
                            insertableId={insertableId}
                            status={insertable}
                        />
                    </CardSection>
                    <ConfigurationSection
                        insertableId={insertableId}
                        status={insertable}
                    />
                    <UsageSection
                        elementId={insertable.elementPath.elementId}
                    />
                </>
            }
        />
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
                    sections={
                        <CardSection id={SectionId.SETTINGS} title="Settings">
                            <GroupSettings
                                groupId={groupId}
                                status={groupStatus}
                            />
                        </CardSection>
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
