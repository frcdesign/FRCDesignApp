import {
    Badge,
    Center,
    Divider,
    Loader,
    Menu,
    Text,
    Tooltip
} from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowsClockwiseIcon,
    ArrowsDownUpIcon,
    ArrowSquareOutIcon,
    LinkBreakIcon,
    TreeStructureIcon
} from "@phosphor-icons/react";
import { type MouseEvent, type ReactNode } from "react";
import {
    isSameWorkspace,
    LinkDirection,
    PullScopeKind,
    PushScopeKind,
    VersionJobKind,
    VersionJobState,
    workspaceThumbnailUrl,
    type LinkedWorkspace,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { ThumbnailSize } from "@backend/features/thumbnails/contract";
import { MenuButton, MenuSection } from "../../../components/app-menu";
import { InfoTooltip } from "../../../components/info-tooltip";
import { CardTitle, ItemRow, ItemTable } from "../../../components/item-row";
import { SectionNotice } from "../../../components/app-notice";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import {
    IconSize,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import styles from "../../../lib/styles.module.css";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import {
    openPullReferencesModal,
    openPushVersionModal
} from "../open-version-modals";
import { quickClickName, retireQuickActionTip } from "../version-manager-tips";
import { plural } from "../../../lib/plural";
import { runningHeadline } from "../job-report";
import {
    useMoveLinkMutation,
    usePullReferencesMutation,
    usePushVersionMutation,
    useRemoveLinkMutation,
    useVersionJobQuery
} from "../queries";
import { AddLinkRow } from "./add-link-input";
import { documentLabel } from "../document-label";

/** What each direction is called and does, kept in one place. */
export const DIRECTION_COPY = {
    [LinkDirection.PARENT]: {
        title: "Parents",
        quickAction: "Quick pull",
        description: "Documents you can pull changes from.",
        empty: "No linked parents"
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        quickAction: "Quick push",
        description: "Documents you can push changes to.",
        empty: "No linked children"
    }
} as const;

/** The other side of the list a link is in, which is where a move sends it. */
const OTHER_DIRECTION = {
    [LinkDirection.PARENT]: LinkDirection.CHILD,
    [LinkDirection.CHILD]: LinkDirection.PARENT
} as const;

/** The kind of run each direction's actions start. */
const DIRECTION_KIND = {
    [LinkDirection.PARENT]: VersionJobKind.PULL,
    [LinkDirection.CHILD]: VersionJobKind.PUSH
} as const;

interface DirectionIconProps {
    direction: LinkDirection;
    size?: number;
    /** Left out inside a button, which has already set the color it reads in. */
    color?: string;
}

/** The arrow a direction is marked with, on its title and its buttons. */
export function DirectionIcon(props: DirectionIconProps): ReactNode {
    const { direction, size = IconSize.MEDIUM, color } = props;
    return direction === LinkDirection.CHILD ? (
        <ArrowLineUpIcon size={size} color={color} />
    ) : (
        <ArrowLineDownIcon size={size} color={color} />
    );
}

interface DirectionInfoProps {
    direction: LinkDirection;
}

/** What a direction means, beside its title. */
export function DirectionInfo(props: DirectionInfoProps): ReactNode {
    return (
        <InfoTooltip
            label={DIRECTION_COPY[props.direction].description}
            // Nudged as the section's own icon is, so the two icons on the row
            // share a centre.
            className={`${styles.noShrink} ${styles.titleIcon}`}
        />
    );
}

/** Whether the click asked for the run rather than the form. */
function isQuickClick(event: MouseEvent): boolean {
    return event.ctrlKey || event.metaKey;
}

interface RunningIndicatorProps {
    status: VersionJobStatus;
}

/** A run going, beside the row or section it is aimed at. */
function RunningIndicator(props: RunningIndicatorProps): ReactNode {
    return (
        <Tooltip label={`${runningHeadline(props.status)}...`}>
            <Center className={styles.noShrink}>
                <Loader size={IconSize.SMALL} />
            </Center>
        </Tooltip>
    );
}

/**
 * Everything a section and its rows can run, held once per direction so the
 * header outside the accordion panel and the rows inside it share a run.
 */
interface LinkActions {
    /** The run going from this workspace, whichever direction it is. */
    running: VersionJobStatus | undefined;
    /** Whether that run is this direction's and aimed at exactly `linked`. */
    isRunningFor: (linked: LinkedWorkspace) => boolean;
    /** Whether it is this direction's and aimed at the whole section. */
    isRunningForAll: boolean;
    /** Opens one link's form. A whole direction has none: one name cannot
     * stand for the several versions it cuts. */
    openOne: (linked: LinkedWorkspace) => void;
    /** Runs it under the defaults the form would have shown. */
    quickAll: (recursive: boolean) => void;
    quickOne: (linked: LinkedWorkspace, recursive: boolean) => void;
    /** Moves one link's references onto versions that exist, cutting none. */
    updateOne: (linked: LinkedWorkspace) => void;
    /**
     * The same for every child; for parents, every out-of-date reference,
     * linked or not.
     */
    updateAll: () => void;
}

/** Updating all reaches every out-of-date reference, linked or not. */
function wholePullKind(
    recursive: boolean,
    updateOnly: boolean
): Exclude<PullScopeKind, PullScopeKind.ONE> {
    if (updateOnly) {
        return PullScopeKind.ALL;
    }
    return recursive ? PullScopeKind.ANCESTORS : PullScopeKind.PARENTS;
}

export function useLinkActions(
    workspace: WorkspacePath,
    direction: LinkDirection
): LinkActions {
    const pull = usePullReferencesMutation(workspace);
    const push = usePushVersionMutation(workspace);
    const { data: status } = useVersionJobQuery(workspace);
    const isChild = direction === LinkDirection.CHILD;

    const running =
        status?.state === VersionJobState.RUNNING ? status : undefined;
    const ownTargets =
        running?.kind === DIRECTION_KIND[direction]
            ? (running.targets ?? [])
            : undefined;

    /** A push for children, a pull for parents; `each` absent for the whole section. */
    const start = (
        each: LinkedWorkspace | undefined,
        { recursive = false, updateOnly = false } = {}
    ) => {
        if (isChild) {
            push.mutate({
                scope: each
                    ? {
                          kind: PushScopeKind.ONE,
                          workspace: each.workspace,
                          recursive
                      }
                    : {
                          kind: recursive
                              ? PushScopeKind.DESCENDANTS
                              : PushScopeKind.CHILDREN
                      },
                updateOnly
            });
            return;
        }
        pull.mutate({
            scope: each
                ? {
                      kind: PullScopeKind.ONE,
                      workspace: each.workspace,
                      recursive
                  }
                : { kind: wholePullKind(recursive, updateOnly) },
            updateOnly
        });
    };

    const quick = (each: LinkedWorkspace | undefined, recursive: boolean) => {
        // They have found the shortcut, so the form stops pointing at it.
        retireQuickActionTip();
        start(each, { recursive });
    };

    return {
        running,
        isRunningFor: (each) =>
            ownTargets?.length === 1 &&
            isSameWorkspace(ownTargets[0].workspace, each.workspace),
        isRunningForAll: ownTargets !== undefined && ownTargets.length !== 1,
        openOne: (each) =>
            isChild
                ? openPushVersionModal(workspace, each)
                : openPullReferencesModal(workspace, each),
        quickAll: (recursive) => quick(undefined, recursive),
        quickOne: (each, recursive) => quick(each, recursive),
        updateOne: (each) => start(each, { updateOnly: true }),
        updateAll: () => start(undefined, { updateOnly: true })
    };
}

interface SectionActionsProps {
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    actions: LinkActions;
}

/** The whole section's actions, which sit in its header as a menu. */
export function SectionActions(props: SectionActionsProps): ReactNode {
    const { direction, linked, actions } = props;
    const { running } = actions;
    const disabled = running !== undefined || linked.length === 0;

    return (
        <>
            {running && actions.isRunningForAll && (
                <RunningIndicator status={running} />
            )}
            <MenuButton>
                <RunMenuSection
                    direction={direction}
                    disabled={disabled}
                    // For parents it reaches past the list, to every
                    // out-of-date reference, so needs none linked.
                    updateDisabled={
                        direction === LinkDirection.CHILD
                            ? disabled
                            : running !== undefined
                    }
                    onQuick={() => actions.quickAll(false)}
                    onQuickRecursive={() => actions.quickAll(true)}
                    onUpdate={actions.updateAll}
                />
            </MenuButton>
        </>
    );
}

interface RunMenuSectionProps {
    direction: LinkDirection;
    /** For one link, which names its shortcut; omitted for the whole section. */
    linked?: LinkedWorkspace;
    disabled: boolean;
    /** @default disabled */
    updateDisabled?: boolean;
    onQuick: () => void;
    onQuickRecursive: () => void;
    onUpdate: () => void;
}

/** The runs a row or a section offers; the form is a click on the row itself. */
function RunMenuSection(props: RunMenuSectionProps): ReactNode {
    const {
        direction,
        linked,
        disabled,
        updateDisabled = disabled,
        onQuick,
        onQuickRecursive,
        onUpdate
    } = props;
    const isChild = direction === LinkDirection.CHILD;
    const copy = DIRECTION_COPY[direction];

    return (
        <MenuSection label={isChild ? "Push" : "Pull"}>
            <Menu.Item
                leftSection={<DirectionIcon direction={direction} />}
                rightSection={
                    linked && (
                        <Text size="xs" c={StatusColor.DIMMED}>
                            {quickClickName()}
                        </Text>
                    )
                }
                disabled={disabled}
                onClick={onQuick}
            >
                {copy.quickAction}
            </Menu.Item>
            <Menu.Item
                leftSection={<TreeStructureIcon size={IconSize.MEDIUM} />}
                disabled={disabled}
                onClick={onQuickRecursive}
            >
                {isChild ? "Quick recursive push" : "Quick recursive pull"}
            </Menu.Item>
            <Menu.Item
                leftSection={<ArrowsClockwiseIcon size={IconSize.MEDIUM} />}
                disabled={updateDisabled}
                onClick={onUpdate}
            >
                {linked ? "Update references" : "Update all references"}
            </Menu.Item>
        </MenuSection>
    );
}

interface LinkedWorkspaceSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    actions: LinkActions;
}

/** One direction's links, and the field that adds another underneath them. */
export function LinkedWorkspaceSection(
    props: LinkedWorkspaceSectionProps
): ReactNode {
    const { workspace, direction, linked, actions } = props;
    const removeLink = useRemoveLinkMutation(workspace);
    const moveLink = useMoveLinkMutation(workspace);
    const copy = DIRECTION_COPY[direction];

    return (
        <>
            {linked.length === 0 && (
                <>
                    <SectionNotice
                        title={copy.empty}
                        icon={
                            <DirectionIcon
                                direction={direction}
                                size={IconSize.SECTION}
                                color={PrimaryColor.FILLED}
                            />
                        }
                    />
                    {/* The field below is a table row, and a row rules off
                        underneath itself; this is the line above it. */}
                    <Divider />
                </>
            )}
            <ItemTable>
                {linked.map((each) => (
                    <LinkedWorkspaceRow
                        key={each.linkId}
                        linked={each}
                        direction={direction}
                        actions={actions}
                        onRemove={() => removeLink.mutate(each.linkId)}
                        onMove={() =>
                            moveLink.mutate({
                                linkId: each.linkId,
                                direction: OTHER_DIRECTION[direction]
                            })
                        }
                    />
                ))}
                <AddLinkRow workspace={workspace} direction={direction} />
            </ItemTable>
        </>
    );
}

interface LinkedWorkspaceRowProps {
    linked: LinkedWorkspace;
    direction: LinkDirection;
    actions: LinkActions;
    onRemove: () => void;
    /** Files the link under the other direction. */
    onMove: () => void;
}

function LinkedWorkspaceRow(props: LinkedWorkspaceRowProps): ReactNode {
    const { linked, direction, actions, onRemove, onMove } = props;
    const origin = useOnshapeOrigin();
    const url = makeUrl(origin, linked.workspace);
    const { running } = actions;

    const menuItems = (
        <>
            {/* Nothing can be run on a document the caller cannot read. */}
            {linked.isOpenable && (
                <RunMenuSection
                    direction={direction}
                    linked={linked}
                    disabled={running !== undefined}
                    onQuick={() => actions.quickOne(linked, false)}
                    onQuickRecursive={() => actions.quickOne(linked, true)}
                    onUpdate={() => actions.updateOne(linked)}
                />
            )}
            <MenuSection label="Link">
                {linked.isOpenable && (
                    <Menu.Item
                        leftSection={
                            <ArrowSquareOutIcon size={IconSize.MEDIUM} />
                        }
                        onClick={() => openUrlInNewTab(url)}
                    >
                        Open document
                    </Menu.Item>
                )}
                <Menu.Item
                    leftSection={<ArrowsDownUpIcon size={IconSize.MEDIUM} />}
                    onClick={onMove}
                >
                    {direction === LinkDirection.PARENT
                        ? "Switch to child"
                        : "Switch to parent"}
                </Menu.Item>
                <Menu.Item
                    color={StatusColor.ERROR}
                    leftSection={<LinkBreakIcon size={IconSize.MEDIUM} />}
                    onClick={onRemove}
                >
                    Remove link
                </Menu.Item>
            </MenuSection>
        </>
    );

    return (
        <ItemRow
            left={<LinkedWorkspaceTitle linked={linked} />}
            menuItems={menuItems}
            // Its own menu button, so the spinner comes before it.
            moreButton={false}
            // A click opens the form; a modified one runs it with the defaults.
            onClick={(event) => {
                if (running || !linked.isOpenable) {
                    return;
                }
                if (isQuickClick(event)) {
                    actions.quickOne(linked, false);
                    return;
                }
                actions.openOne(linked);
            }}
            rightSection={
                <>
                    {running && actions.isRunningFor(linked) && (
                        <RunningIndicator status={running} />
                    )}
                    <MenuButton>{menuItems}</MenuButton>
                </>
            }
        />
    );
}

interface LinkedWorkspaceThumbnailProps {
    linked: LinkedWorkspace;
}

/** The thumbnail Onshape keeps for the document; a placeholder if unreadable. */
function LinkedWorkspaceThumbnail(
    props: LinkedWorkspaceThumbnailProps
): ReactNode {
    const { linked } = props;
    if (!linked.isOpenable) {
        return <CardThumbnail />;
    }
    return (
        <CardThumbnail
            smallThumbnailUrl={workspaceThumbnailUrl(
                linked.workspace,
                ThumbnailSize.SMALL
            )}
            largeThumbnailUrl={workspaceThumbnailUrl(
                linked.workspace,
                ThumbnailSize.LARGE
            )}
        />
    );
}

interface LinkedWorkspaceTitleProps {
    linked: LinkedWorkspace;
}

/** The document and workspace a link points at; only that it exists, if unreadable. */
function LinkedWorkspaceTitle(props: LinkedWorkspaceTitleProps): ReactNode {
    const { linked } = props;
    const thumbnail = <LinkedWorkspaceThumbnail linked={linked} />;

    if (!linked.isOpenable) {
        return (
            <CardTitle
                title="Missing access"
                thumbnail={thumbnail}
                titleColor={StatusColor.ERROR}
                subtitle={
                    <Text size="xs" c={StatusColor.ERROR} truncate>
                        You cannot open this document
                    </Text>
                }
            />
        );
    }

    return (
        <CardTitle
            title={documentLabel(linked.documentName)}
            thumbnail={thumbnail}
            badge={
                <UnversionedChangesBadge changes={linked.unversionedChanges} />
            }
            subtitle={
                linked.workspaceName && (
                    <Text size="xs" c={StatusColor.DIMMED} truncate>
                        {linked.workspaceName}
                    </Text>
                )
            }
        />
    );
}

interface UnversionedChangesBadgeProps {
    /** Undefined where Onshape was not asked, or would not answer. */
    changes: number | undefined;
}

/** What the parent has changed since its own last version, which a pull versions. */
function UnversionedChangesBadge(
    props: UnversionedChangesBadgeProps
): ReactNode {
    const { changes } = props;
    if (!changes) {
        return null;
    }

    return (
        <Tooltip label={`${plural(changes, "change")} since the last version.`}>
            <Badge className={styles.noShrink}>
                {plural(changes, "change")}
            </Badge>
        </Tooltip>
    );
}
