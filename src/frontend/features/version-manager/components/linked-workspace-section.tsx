import {
    Button,
    Center,
    Group,
    Loader,
    Menu,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowsClockwiseIcon,
    ArrowSquareOutIcon,
    FileIcon,
    InfoIcon,
    LinkBreakIcon,
    ProhibitIcon,
    TreeStructureIcon
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    PullScopeKind,
    PushScopeKind,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { MenuButton, MenuSection } from "../../../components/app-menu";
import { ItemRow, ItemTable } from "../../../components/item-row";
import { SectionNotice } from "../../../components/app-zero-state";
import { TruncatedText } from "../../../components/truncated-text";
import { IconSize, NO_SHRINK, StatusColor } from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import {
    openPullReferencesModal,
    openPushVersionModal
} from "../open-version-modals";
import { retireQuickActionTip } from "../version-manager-tips";
import {
    useIsVersionJobRunning,
    usePullReferencesMutation,
    usePushVersionMutation,
    useRemoveLinkMutation
} from "../queries";
import { AddLinkInput } from "./add-link-input";

/** What each direction is called and does, kept in one place. */
export const DIRECTION_COPY = {
    [LinkDirection.PARENT]: {
        title: "Parents",
        allAction: "Pull from all",
        rowAction: "Pull",
        running: "Pulling from Onshape...",
        description:
            "Workspaces this one references. Pulling moves this workspace's references onto their latest versions.",
        empty: "No parents linked."
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        allAction: "Push to all",
        rowAction: "Push",
        running: "Pushing to Onshape...",
        description:
            "Workspaces that reference this one. Pushing creates a version here and moves their references onto it.",
        empty: "No children linked."
    }
} as const;

/** What a run can be aimed at: everything in a direction, or one link. */
const ALL_TARGET = "all";

/** Phosphor takes a CSS color, which the theme's dimmed name is not. */
const DIMMED_ICON = "var(--mantine-color-dimmed)";
const ERROR_ICON = "var(--mantine-color-error)";

/** The arrow a direction is marked with, on its title and its buttons. */
export function DirectionIcon(props: {
    direction: LinkDirection;
    size?: number;
}): ReactNode {
    const { direction, size = IconSize.MEDIUM } = props;
    return direction === LinkDirection.CHILD ? (
        <ArrowLineUpIcon size={size} />
    ) : (
        <ArrowLineDownIcon size={size} />
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
    /** This button's run is the one going, so it carries the spinner. */
    loading: boolean;
    disabled: boolean;
    /** Why it is disabled, when Onshape is the reason. */
    forbidden?: boolean;
    onClick: () => void;
}

/**
 * A push or a pull, with its arrow after the label. Reports its own progress:
 * a run outlives the click, so the button that started it is where it is shown
 * rather than in a banner over the page.
 */
function ActionButton(props: ActionButtonProps): ReactNode {
    const {
        direction,
        label,
        loading,
        disabled,
        forbidden = false,
        onClick
    } = props;

    const tooltip = forbidden
        ? "You do not have permission to do this in Onshape."
        : loading
          ? DIRECTION_COPY[direction].running
          : label;

    return (
        <Tooltip withArrow label={tooltip}>
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
 * The buttons open a form; the menus run the same thing without one. Both end
 * in the same mutation, which is why they are declared together.
 */
export interface LinkActions {
    isRunning: boolean;
    /** What the run going is aimed at: {@link ALL_TARGET} or a link's id. */
    activeTarget: string | undefined;
    /** Opens the form for everything in this direction, or for one link. */
    openAll: () => void;
    openOne: (linked: LinkedWorkspace) => void;
    /** Runs it there and then, under the defaults the form would have shown. */
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
                loading={activeTarget === ALL_TARGET}
                disabled={disabled}
                onClick={actions.openAll}
            />
            <MenuButton>
                <QuickMenuSection
                    direction={direction}
                    disabled={disabled}
                    onQuick={() => actions.quickAll(false)}
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

interface QuickMenuSectionProps {
    direction: LinkDirection;
    disabled: boolean;
    onQuick: () => void;
    onQuickRecursive: () => void;
}

/**
 * The shortcuts past the form, which every menu carries: the same run the form
 * would make from its defaults, and — pushing — the same one carried on down.
 */
function QuickMenuSection(props: QuickMenuSectionProps): ReactNode {
    const { direction, disabled, onQuick, onQuickRecursive } = props;
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
                onClick={onQuick}
            >
                {isChild ? "Quick push" : "Quick pull"}
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
    const copy = DIRECTION_COPY[direction];

    return (
        <Stack gap="sm" p="sm">
            {linked.length === 0 ? (
                <SectionNotice
                    title={copy.empty}
                    description={null}
                    icon={
                        <LinkBreakIcon
                            size={IconSize.PAGE}
                            color={StatusColor.DIMMED}
                        />
                    }
                />
            ) : (
                <ItemTable>
                    {linked.map((each) => (
                        <LinkedWorkspaceRow
                            key={each.linkId}
                            linked={each}
                            direction={direction}
                            actions={actions}
                            onRemove={() => removeLink.mutate(each.linkId)}
                        />
                    ))}
                </ItemTable>
            )}
            <AddLinkInput workspace={workspace} direction={direction} />
        </Stack>
    );
}

function toName(linked: LinkedWorkspace): string {
    return linked.documentName ?? "a document you cannot open";
}

/**
 * Whether this link can be acted on: a push writes to the linked workspace, so
 * it needs the permissions Onshape reported for it; a pull only reads it, which
 * being openable already establishes.
 */
function canAct(linked: LinkedWorkspace, isChild: boolean): boolean {
    return isChild ? linked.canPush : linked.isOpenable;
}

interface LinkedWorkspaceRowProps {
    linked: LinkedWorkspace;
    direction: LinkDirection;
    actions: LinkActions;
    onRemove: () => void;
}

function LinkedWorkspaceRow(props: LinkedWorkspaceRowProps): ReactNode {
    const { linked, direction, actions, onRemove } = props;
    const url = makeUrl(linked.workspace);
    const isChild = direction === LinkDirection.CHILD;
    const allowed = canAct(linked, isChild);
    const disabled = actions.isRunning || !allowed;
    const copy = DIRECTION_COPY[direction];

    const menuItems = (
        <>
            <QuickMenuSection
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
            left={<LinkedWorkspaceTitle linked={linked} allowed={allowed} />}
            menuItems={menuItems}
            // The menu below carries the same items, in the order this row
            // wants them: the action first, then what to do with the link.
            moreButton={false}
            onClick={linked.isOpenable ? () => openUrlInNewTab(url) : undefined}
            rightSection={
                <Group gap={4} wrap="nowrap">
                    {/* Absent rather than disabled where Onshape says no: the
                        row already says so in red, and the menu shows the two
                        runs greyed out. */}
                    {allowed && (
                        <ActionButton
                            direction={direction}
                            label={copy.rowAction}
                            loading={actions.activeTarget === linked.linkId}
                            disabled={actions.isRunning}
                            onClick={() => actions.openOne(linked)}
                        />
                    )}
                    <MenuButton>{menuItems}</MenuButton>
                </Group>
            }
        />
    );
}

interface MissingAccessProps {
    /** What Onshape will not let them do, e.g. "open this document". */
    reason: string;
}

/** Why a link cannot be acted on, in the place its subtitle would have been. */
function MissingAccess(props: MissingAccessProps): ReactNode {
    return (
        <Stack gap={0} miw={0}>
            <Text size="sm" c={StatusColor.ERROR}>
                Missing access
            </Text>
            <Text size="xs" c={StatusColor.ERROR} truncate>
                You cannot {props.reason}
            </Text>
        </Stack>
    );
}

interface LinkedWorkspaceTitleProps {
    linked: LinkedWorkspace;
    /** Whether this direction's action can be run on it. */
    allowed: boolean;
}

/**
 * The document and workspace a link points at. A link the caller cannot read
 * shows that it exists and nothing else: what it points at is not theirs to
 * know, and the row is still theirs to remove.
 */
function LinkedWorkspaceTitle(props: LinkedWorkspaceTitleProps): ReactNode {
    const { linked, allowed } = props;

    if (!linked.isOpenable) {
        return (
            <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
                <ProhibitIcon size={IconSize.MEDIUM} color={ERROR_ICON} />
                <MissingAccess reason="open this document" />
            </Group>
        );
    }

    // Readable but unnamed: the document answered, and had nothing to say.
    const documentName = linked.documentName ?? "Untitled document";

    return (
        <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
            <FileIcon size={IconSize.MEDIUM} color={DIMMED_ICON} />
            <Stack gap={0} miw={0}>
                <TruncatedText hoverText={documentName} size="sm">
                    {documentName}
                </TruncatedText>
                {/* Readable but not writable, which only a push runs into. */}
                {!allowed ? (
                    <Text size="xs" c={StatusColor.ERROR} truncate>
                        Missing access &mdash; you cannot edit this document
                    </Text>
                ) : (
                    linked.workspaceName && (
                        <Text size="xs" c={StatusColor.DIMMED} truncate>
                            {linked.workspaceName}
                        </Text>
                    )
                )}
            </Stack>
        </Group>
    );
}
