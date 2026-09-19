import {
    Button,
    Center,
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
    ArrowSquareOutIcon,
    InfoIcon,
    LinkBreakIcon,
    TreeStructureIcon
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
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
import { CardTitle, ItemRow, ItemTable } from "../../../components/item-row";
import { SectionNotice } from "../../../components/app-zero-state";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import {
    IconSize,
    NO_SHRINK,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import {
    openPullReferencesModal,
    openPushVersionModal
} from "../open-version-modals";
import { retireQuickActionTip } from "../version-manager-tips";
import {
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
        allAction: "Pull from all",
        rowAction: "Pull",
        quickAll: "Quick pull from every parent",
        quickRow: "Quick pull",
        running: "Pulling from Onshape...",
        description:
            "Workspaces this one references. Pulling moves this workspace's references onto their latest versions.",
        empty: "No linked parents"
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        allAction: "Push to all",
        rowAction: "Push",
        quickAll: "Quick push to every child",
        quickRow: "Quick push",
        running: "Pushing to Onshape...",
        description:
            "Workspaces that reference this one. Pushing creates a version here and moves their references onto it.",
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

/** Phosphor takes a CSS color, which the theme's dimmed name is not. */
const DIMMED_ICON = "var(--mantine-color-dimmed)";

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
        <Tooltip
            withArrow
            multiline
            w={260}
            label={DIRECTION_COPY[props.direction].description}
        >
            <Center>
                <InfoIcon size={IconSize.SMALL} color={DIMMED_ICON} />
            </Center>
        </Tooltip>
    );
}

interface ActionButtonProps {
    direction: LinkDirection;
    label: string;
    /** What it runs, which its label does not say: every button is a quick one. */
    tooltip: string;
    /** This button's run is the one going, so it carries the spinner. */
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}

/**
 * A push or a pull, with its arrow after the label. Reports its own progress:
 * a run outlives the click, so the button that started it is where it is shown
 * rather than in a banner over the page.
 */
function ActionButton(props: ActionButtonProps): ReactNode {
    const { direction, label, tooltip, loading, disabled, onClick } = props;
    const hint = loading ? DIRECTION_COPY[direction].running : tooltip;

    return (
        <Tooltip withArrow label={hint}>
            {/* A span, so the tooltip still has something to hang off when the
                button inside it is disabled and stops firing events. */}
            <span style={NO_SHRINK}>
                <Button
                    size="compact-sm"
                    variant="light"
                    rightSection={
                        loading ? (
                            <Loader size={IconSize.SMALL} />
                        ) : (
                            <DirectionIcon
                                direction={direction}
                                size={IconSize.SMALL}
                            />
                        )
                    }
                    disabled={disabled}
                    onClick={(event) => {
                        // The row itself opens Onshape; this button does not.
                        event.stopPropagation();
                        onClick();
                    }}
                >
                    {label}
                </Button>
            </span>
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
    /** Opens the form for everything in this direction, or for one link. */
    openAll: () => void;
    openOne: (linked: LinkedWorkspace) => void;
    /** Runs it under the defaults the form would have shown. */
    quickAll: (recursive: boolean) => void;
    quickOne: (linked: LinkedWorkspace, recursive: boolean) => void;
    /** Parents only: every out-of-date reference, linked or not. */
    updateAllReferences: () => void;
}

export function useLinkActions(
    workspace: WorkspacePath,
    direction: LinkDirection,
    linked: LinkedWorkspace[]
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
        pull.mutate(
            each
                ? { kind: PullScopeKind.ONE, workspace: each.workspace }
                : { kind: PullScopeKind.PARENTS }
        );
    };

    const open = (each?: LinkedWorkspace) => {
        setStartedTarget(each ? each.linkId : ALL_TARGET);
        const names = each ? [toName(each)] : linked.map(toName);
        if (isChild) {
            openPushVersionModal(workspace, {
                title: each ? `Push to ${toName(each)}` : "Push to every child",
                target: each,
                targets: names
            });
            return;
        }
        openPullReferencesModal(workspace, {
            title: each
                ? `Pull from ${toName(each)}`
                : "Pull from every parent",
            source: each,
            sources: names
        });
    };

    return {
        isRunning,
        // Derived rather than cleared when the run ends: clearing would be a
        // state write from an effect, and a stale target simply goes unused.
        activeTarget: isRunning ? startedTarget : undefined,
        openAll: () => open(),
        openOne: (each) => open(each),
        quickAll: (recursive) => runQuick(undefined, recursive),
        quickOne: (each, recursive) => runQuick(each, recursive),
        updateAllReferences: () => {
            retireQuickActionTip();
            setStartedTarget(ALL_TARGET);
            pull.mutate({ kind: PullScopeKind.ALL });
        }
    };
}

interface SectionActionsProps {
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    actions: LinkActions;
}

/** The whole section's button and menu, which sit in its header. */
export function SectionActions(props: SectionActionsProps): ReactNode {
    const { direction, linked, actions } = props;
    const { isRunning, activeTarget } = actions;
    const copy = DIRECTION_COPY[direction];
    const isChild = direction === LinkDirection.CHILD;
    const disabled = isRunning || linked.length === 0;

    return (
        <>
            <ActionButton
                direction={direction}
                label={copy.allAction}
                tooltip={copy.quickAll}
                loading={activeTarget === ALL_TARGET}
                disabled={disabled}
                onClick={() => actions.quickAll(false)}
            />
            <MenuButton>
                <ActionMenuSection
                    direction={direction}
                    formLabel={`${copy.allAction}...`}
                    disabled={disabled}
                    onOpenForm={actions.openAll}
                    onQuickRecursive={() => actions.quickAll(true)}
                />
                {!isChild && (
                    <MenuSection label="Pull">
                        {/* Every out-of-date reference, linked or not, which is
                            the one thing the parent list cannot express. */}
                        <Menu.Item
                            leftSection={
                                <ArrowsClockwiseIcon size={IconSize.MEDIUM} />
                            }
                            disabled={isRunning}
                            onClick={actions.updateAllReferences}
                        >
                            Update all references
                        </Menu.Item>
                    </MenuSection>
                )}
            </MenuButton>
        </>
    );
}

interface ActionMenuSectionProps {
    direction: LinkDirection;
    /** Ends in an ellipsis: it opens the form rather than running anything. */
    formLabel: string;
    disabled: boolean;
    onOpenForm: () => void;
    onQuickRecursive: () => void;
}

/**
 * What the buttons do not: the form, for a run that wants a version name or a
 * wider scope, and — pushing — the recursive walk.
 */
function ActionMenuSection(props: ActionMenuSectionProps): ReactNode {
    const { direction, formLabel, disabled, onOpenForm, onQuickRecursive } =
        props;
    const isChild = direction === LinkDirection.CHILD;

    return (
        <MenuSection label={isChild ? "Push" : "Pull"}>
            <Menu.Item
                leftSection={
                    <DirectionIcon
                        direction={direction}
                        size={IconSize.MEDIUM}
                    />
                }
                disabled={disabled}
                onClick={onOpenForm}
            >
                {formLabel}
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
                <SectionNotice
                    // Beside the text rather than over it: one line saying a
                    // list is empty should not take a list's worth of room.
                    align="left"
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
    const url = makeUrl(linked.workspace);
    const disabled = actions.isRunning;
    const copy = DIRECTION_COPY[direction];

    const menuItems = (
        <>
            <ActionMenuSection
                direction={direction}
                formLabel={`${copy.rowAction}...`}
                disabled={disabled}
                onOpenForm={() => actions.openOne(linked)}
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
                    which is a move rather than a delete and a re-add. */}
                <Menu.Item
                    leftSection={
                        <DirectionIcon
                            direction={OTHER_DIRECTION[direction]}
                            size={IconSize.MEDIUM}
                        />
                    }
                    onClick={onMove}
                >
                    {direction === LinkDirection.PARENT
                        ? "Move to child"
                        : "Move to parent"}
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
            // The form, where the button beside it is the run itself. Opening
            // the document moved to the menu: this list is for pushing and
            // pulling, and that is what a row should be one click from.
            onClick={() => actions.openOne(linked)}
            rightSection={
                <Group gap={4} wrap="nowrap">
                    <ActionButton
                        direction={direction}
                        label={copy.rowAction}
                        tooltip={copy.quickRow}
                        loading={actions.activeTarget === linked.linkId}
                        disabled={actions.isRunning}
                        onClick={() => actions.quickOne(linked, false)}
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
