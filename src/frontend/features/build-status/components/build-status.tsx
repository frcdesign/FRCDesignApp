import { Badge, Group, Image, Loader, Text, Tooltip } from "@mantine/core";
import {
    EyeSlashIcon,
    GitBranchIcon,
    HourglassIcon
} from "@phosphor-icons/react";
import { ReactElement, ReactNode } from "react";
import partStudioIcon from "/part-studio.svg";
import assemblyIcon from "/assembly.svg";
import { formatShortTimeAgo } from "../../../lib/format-time";
import {
    BuildIssue,
    getMaxSeverity
} from "@backend/features/build-checker/issues";
import { ElementType } from "@backend/lib/onshape/element-type";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { AppIcon } from "../../../components/app-icon";
import { AppHoverBubble } from "../../../components/app-hover-bubble";
import { DotIndicator } from "../../../components/dot-indicator";
import { RequireAccessLevel } from "../../auth/components/require-access";
import { useBuildStatusQuery } from "../queries";
import { useIsGroupLoading } from "../../library/queries";
import { useHasIndexingDraft } from "../indexing-draft";
import { m } from "../../../paraglide/messages";
import { SectionId } from "../../../lib/ui-state";
import {
    BuildIssueList,
    type ConfigurationTarget,
    IssueIcon,
    SeverityBadges
} from "./issues";
import { ConfigurationSection } from "./configuration-section";
import { GroupSettings, InsertableSettings } from "./admin-section";
import { GroupUsageSection, PartUsageSection } from "./usage-section";
import { CardSection, CardSections } from "./card-section";
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
    /** Beside the title in place of the status, which the badges under it give. */
    elementType?: ElementType;
}

interface BuildStatusBadgeProps extends BuildStatusSubject {
    /** The group/insertable sections under the build checks, each keyed; false to skip one. */
    sections: (ReactElement | false)[];
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

    const body = [
        issues.length > 0 && (
            <CardSection
                key="build-checks"
                id={SectionId.BUILD_CHECKS}
                title={m.adminCardBuildChecks()}
            >
                <BuildIssueList
                    issues={issues}
                    configurationTarget={configurationTarget}
                />
            </CardSection>
        ),
        ...sections
    ].filter((section) => section !== false);

    return (
        <AppHoverBubble
            interactive
            target={
                <DotIndicator shown={hasUnsavedEdits} offset={2}>
                    {loading ? (
                        <Loader size={IconSize.SMALL} />
                    ) : (
                        statusIcon(IconSize.SMALL)
                    )}
                </DotIndicator>
            }
            header={{
                // A group's keeps the status, since its target spins while loading.
                icon: elementType ? (
                    <ElementTypeIcon elementType={elementType} />
                ) : (
                    statusIcon(IconSize.CONTROL)
                ),
                title: name,
                rightSection: (
                    <VersionAge
                        groupId={groupId}
                        versionCreatedAt={versionCreatedAt}
                    />
                ),
                subtitle: <SeverityBadges issues={issues} />
            }}
        >
            <CardSections sections={body} />
        </AppHoverBubble>
    );
}

/** Onshape's own tab icons, which its users already know the two by. */
const ELEMENT_TYPES: Record<
    ElementType,
    { label: () => string; icon: string }
> = {
    [ElementType.PART_STUDIO]: {
        label: m.adminCardPartStudio,
        icon: partStudioIcon
    },
    [ElementType.ASSEMBLY]: { label: m.adminCardAssembly, icon: assemblyIcon }
};

interface ElementTypeIconProps {
    elementType: ElementType;
}

function ElementTypeIcon(props: ElementTypeIconProps): ReactNode {
    const { elementType } = props;
    return (
        <Tooltip label={ELEMENT_TYPES[elementType].label()}>
            <Image
                src={ELEMENT_TYPES[elementType].icon}
                w={IconSize.MEDIUM}
                h={IconSize.MEDIUM}
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
            <Tooltip label={m.adminCardLoading()}>
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
                    : m.adminCardVersionUnknown()}
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
    const { parameters } = insertable;
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
                parameters.length > 0
                    ? { elementPath: insertable.elementPath, parameters }
                    : undefined
            }
            sections={[
                <CardSection
                    key="settings"
                    id={SectionId.SETTINGS}
                    title={m.adminCardSettings()}
                >
                    <InsertableSettings
                        insertableId={insertableId}
                        status={insertable}
                    />
                </CardSection>,
                parameters.length > 0 && (
                    <ConfigurationSection
                        key="configuration"
                        insertableId={insertableId}
                        status={insertable}
                        parameters={parameters}
                    />
                ),
                <PartUsageSection
                    key="usage"
                    elementId={insertable.elementPath.elementId}
                />
            ]}
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
    const elementIds = (groupStatus?.insertableOrder ?? []).flatMap(
        (insertableId) => {
            const insertable = data?.insertables[insertableId];
            return insertable ? [insertable.elementPath.elementId] : [];
        }
    );
    return (
        <>
            {groupStatus && (
                <BuildStatusBadge
                    name={name}
                    groupId={groupId}
                    issues={groupStatus.buildIssues}
                    versionCreatedAt={groupStatus.versionCreatedAt}
                    sections={[
                        <CardSection
                            key="settings"
                            id={SectionId.SETTINGS}
                            title={m.adminCardSettings()}
                        >
                            <GroupSettings
                                groupId={groupId}
                                status={groupStatus}
                            />
                        </CardSection>,
                        <GroupUsageSection
                            key="usage"
                            elementIds={elementIds}
                        />
                    ]}
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
            {m.adminCardAwaitingApproval()}
        </Badge>
    );
}
