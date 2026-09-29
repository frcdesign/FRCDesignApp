import {
    Badge,
    Center,
    Divider,
    Group,
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
import { type MouseEvent, useState, type ReactNode } from "react";
import { useOs } from "@mantine/hooks";
import {
    LinkDirection,
    PullScopeKind,
    PushScopeKind,
    workspaceThumbnailUrl,
    type LinkedWorkspace,
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
import { retireQuickActionTip } from "../version-manager-tips";
import {
    plural,
    useIsVersionJobRunning,
    useMoveLinkMutation,
    usePullReferencesMutation,
    usePushVersionMutation,
    useRemoveLinkMutation
} from "../queries";
import { AddLinkRow } from "./add-link-input";

/** What each direction is called and does, kept in one place. */
export const DIRECTION_COPY = {
    [LinkDirection.PARENT]: {
        title: "Parents",
        allAction: "Quick pull from all",
        rowAction: "Quick pull",
        running: "Pulling from Onshape...",
        description:
            "Documents this one uses parts from. Pulling saves a new version of the parent and updates this document to use it.",
        empty: "No linked parents"
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        allAction: "Quick push to all",
        rowAction: "Quick push",
        running: "Pushing to Onshape...",
        description:
            "Documents that use parts from this one. Pushing saves a new version of this document and updates each child to use it.",
        empty: "No linked children"
    }
} as const;

/** The other side of the list a link is in, which is where a move sends it. */
const OTHER_DIRECTION = {
    [LinkDirection.PARENT]: LinkDirection.CHILD,
    [LinkDirection.CHILD]: LinkDirection.PARENT
} as const;

/** What a run can be aimed at: everything in a direction, or one link. */
const ALL_TARGET = "all";

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

/**
 * What a direction means, on the title rather than over the list: a line of
 * explanation earns its room the first few times and never again, which is
 * what a bubble is for.
 */
export function DirectionInfo(props: { direction: LinkDirection }): ReactNode {
    return (
        <InfoTooltip
            label={DIRECTION_COPY[props.direction].description}
            // Nudged as the section's own icon is, so the two icons on the row
            // share a centre.
            className={`${styles.noShrink} ${styles.titleIcon}`}
        />
    );
}

/**
 * The key that turns a click into the run itself. Onshape's panel is a browser
 * pane, and on a Mac ctrl-click is the context menu there, so the command key
 * is what a Mac reads instead.
 */
function useQuickKeyLabel(): string {
    return useOs() === "macos" ? "⌘ click" : "Ctrl click";
}

/** Whether the click asked for the run rather than the form. */
function isQuickClick(event: MouseEvent): boolean {
    return event.ctrlKey || event.metaKey;
}

interface RunningIndicatorProps {
    direction: LinkDirection;
    /** Whether this row or section is the one the run was started from. */
    running: boolean;
}

/**
 * Where a run shows itself: beside whatever started it, since a run outlives
 * the click and the page has nothing else moving.
 */
function RunningIndicator(props: RunningIndicatorProps): ReactNode {
    const { direction, running } = props;
    if (!running) {
        return null;
    }
    return (
        <Tooltip withArrow label={DIRECTION_COPY[direction].running}>
            <Center className={styles.noShrink}>
                <Loader size={IconSize.SMALL} />
            </Center>
        </Tooltip>
    );
}

/**
 * Everything a section and its rows can set running, held once per direction so
 * the header outside the accordion panel and the rows inside it share a run.
 *
 * The buttons run it there and then; the form is behind a click on the row and
 * in the menus. Both end in the same mutation, which is why they are declared
 * together.
 */
export interface LinkActions {
    isRunning: boolean;
    /** What the run going is aimed at: {@link ALL_TARGET} or a link's id. */
    activeTarget: string | undefined;
    /**
     * Opens the form for one link. There is none for a whole direction: it
     * would name one version for the several the run cuts.
     */
    openOne: (linked: LinkedWorkspace) => void;
    /** Runs it under the defaults the form would have shown. */
    quickAll: (recursive: boolean) => void;
    quickOne: (linked: LinkedWorkspace, recursive: boolean) => void;
    /** Parents only: every out-of-date reference, linked or not. */
    updateAllReferences: () => void;
}

export function useLinkActions(
    workspace: WorkspacePath,
    direction: LinkDirection
): LinkActions {
    const pull = usePullReferencesMutation(workspace);
    const push = usePushVersionMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);
    const [startedTarget, setStartedTarget] = useState<string>();
    const isChild = direction === LinkDirection.CHILD;

    const runQuick = (
        each: LinkedWorkspace | undefined,
        recursive: boolean
    ) => {
        // They have found the shortcut, so the form stops pointing at it.
        retireQuickActionTip();
        setStartedTarget(each ? each.linkId : ALL_TARGET);
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
                      }
            });
            return;
        }
        pull.mutate({
            scope: each
                ? { kind: PullScopeKind.ONE, workspace: each.workspace }
                : { kind: PullScopeKind.PARENTS }
        });
    };

    const open = (each: LinkedWorkspace) => {
        setStartedTarget(each.linkId);
        if (isChild) {
            openPushVersionModal(workspace, {
                title: `Push to ${toName(each)}`,
                target: each
            });
            return;
        }
        openPullReferencesModal(workspace, {
            title: `Pull from ${toName(each)}`,
            source: each
        });
    };

    return {
        isRunning,
        // Derived rather than cleared when the run ends: clearing would be a
        // state write from an effect, and a stale target simply goes unused.
        activeTarget: isRunning ? startedTarget : undefined,
        openOne: (each) => open(each),
        quickAll: (recursive) => runQuick(undefined, recursive),
        quickOne: (each, recursive) => runQuick(each, recursive),
        updateAllReferences: () => {
            retireQuickActionTip();
            setStartedTarget(ALL_TARGET);
            pull.mutate({ scope: { kind: PullScopeKind.ALL } });
        }
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
    const { isRunning, activeTarget } = actions;
    const copy = DIRECTION_COPY[direction];
    const isChild = direction === LinkDirection.CHILD;
    const disabled = isRunning || linked.length === 0;

    return (
        <>
            <RunningIndicator
                direction={direction}
                running={activeTarget === ALL_TARGET}
            />
            {/* No form among them: one name cannot stand for the several
                versions a run across a whole direction cuts. */}
            <MenuButton>
                <MenuSection label={isChild ? "Push" : "Pull"}>
                    <Menu.Item
                        leftSection={
                            <DirectionIcon
                                direction={direction}
                                size={IconSize.MEDIUM}
                            />
                        }
                        disabled={disabled}
                        onClick={() => actions.quickAll(false)}
                    >
                        {copy.allAction}
                    </Menu.Item>
                    {isChild ? (
                        <Menu.Item
                            leftSection={
                                <TreeStructureIcon size={IconSize.MEDIUM} />
                            }
                            disabled={disabled}
                            onClick={() => actions.quickAll(true)}
                        >
                            Quick recursive push
                        </Menu.Item>
                    ) : (
                        // Every out-of-date reference, linked or not, which is
                        // the one thing the parent list cannot express.
                        <Menu.Item
                            leftSection={
                                <ArrowsClockwiseIcon size={IconSize.MEDIUM} />
                            }
                            disabled={isRunning}
                            onClick={actions.updateAllReferences}
                        >
                            Update all references
                        </Menu.Item>
                    )}
                </MenuSection>
            </MenuButton>
        </>
    );
}

interface ActionMenuSectionProps {
    direction: LinkDirection;
    disabled: boolean;
    onQuick: () => void;
    onQuickRecursive: () => void;
}

/**
 * What a row can run. Only the runs: the form is a click on the row itself,
 * which is where somebody who did not want the defaults already is.
 */
function ActionMenuSection(props: ActionMenuSectionProps): ReactNode {
    const { direction, disabled, onQuick, onQuickRecursive } = props;
    const isChild = direction === LinkDirection.CHILD;
    const quickKey = useQuickKeyLabel();

    return (
        <MenuSection label={isChild ? "Push" : "Pull"}>
            <Menu.Item
                leftSection={
                    <DirectionIcon
                        direction={direction}
                        size={IconSize.MEDIUM}
                    />
                }
                rightSection={
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {quickKey}
                    </Text>
                }
                disabled={disabled}
                onClick={onQuick}
            >
                {DIRECTION_COPY[direction].rowAction}
            </Menu.Item>
            {/* No recursive pull: a pull writes only to this workspace, and
                going further would mean versioning a parent's own parents,
                which is a push and theirs to make. */}
            {isChild && (
                <Menu.Item
                    leftSection={<TreeStructureIcon size={IconSize.MEDIUM} />}
                    disabled={disabled}
                    onClick={onQuickRecursive}
                >
                    Quick recursive push
                </Menu.Item>
            )}
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
                        // Centred with the icon above, as the library's own
                        // empty lists are.
                        title={copy.empty}
                        description={null}
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
            {/* The field is a row of the same table, so it sits on the grid
                every other row does rather than in a card of its own. */}
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

function toName(linked: LinkedWorkspace): string {
    return linked.documentName ?? "a document you cannot open";
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
    const disabled = actions.isRunning;

    const menuItems = (
        <>
            <ActionMenuSection
                direction={direction}
                disabled={disabled}
                onQuick={() => actions.quickOne(linked, false)}
                onQuickRecursive={() => actions.quickOne(linked, true)}
            />
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
                {/* Linked the wrong way up is a paste into the wrong field,
                    which turns the link around rather than deleting and
                    re-adding it. */}
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
            // The menu below carries the same items, in the order this row
            // wants them: the action first, then what to do with the link.
            moreButton={false}
            // A click opens the form; a modified one runs it there and then,
            // which is what the menu's first item says. Opening the document is
            // in the menu: this list is for pushing and pulling, and that is
            // what a row should be one click from.
            onClick={(event) => {
                if (isQuickClick(event)) {
                    actions.quickOne(linked, false);
                    return;
                }
                actions.openOne(linked);
            }}
            rightSection={
                <Group gap={4} wrap="nowrap">
                    <RunningIndicator
                        direction={direction}
                        running={actions.activeTarget === linked.linkId}
                    />
                    <MenuButton>{menuItems}</MenuButton>
                </Group>
            }
        />
    );
}

/**
 * A linked workspace's thumbnail: the one Onshape keeps for the document, at
 * the size every row uses, with the same hover card as a part's.
 *
 * A workspace nobody can read gets none asked for — the placeholder is the
 * answer, and it keeps the row the height of its neighbours.
 */
function LinkedWorkspaceThumbnail(props: {
    linked: LinkedWorkspace;
}): ReactNode {
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

/**
 * The document and workspace a link points at, on the same block every list in
 * the app uses. A link the caller cannot read shows that it exists and nothing
 * else: what it points at is not theirs to know, and the row is still theirs to
 * remove.
 */
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
            // Readable but unnamed: the document answered, and had nothing to
            // say.
            title={linked.documentName ?? "Untitled document"}
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

/**
 * What the workspace has changed since its own last version. A pull moves onto
 * a version, so these are the edits it would leave behind — the count is the
 * one thing a row cannot say by naming the document.
 */
function UnversionedChangesBadge(
    props: UnversionedChangesBadgeProps
): ReactNode {
    const { changes } = props;
    if (!changes) {
        return null;
    }

    return (
        <Tooltip
            withArrow
            multiline
            w={240}
            label={`${plural(changes, "change")} since the last version.`}
        >
            <Badge size="sm" variant="light" className={styles.noShrink}>
                {plural(changes, "change")}
            </Badge>
        </Tooltip>
    );
}
