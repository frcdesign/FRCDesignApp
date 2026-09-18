import {
    Button,
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
    type PushScope,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { MenuButton, MenuSection } from "../../../components/app-menu";
import { ItemRow, ItemTable } from "../../../components/item-row";
import { SectionNotice } from "../../../components/app-zero-state";
import { TruncatedText } from "../../../components/truncated-text";
import { IconSize, NO_SHRINK, StatusColor } from "../../../lib/style-constants";
import { getUiState } from "../../../lib/ui-state";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import { openPushVersionModal } from "../open-push-version-modal";
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
        allAction: "Pull all",
        rowAction: "Pull",
        running: "Pulling from Onshape...",
        description:
            "Workspaces this one references. Pulling moves this workspace's references onto their latest versions.",
        empty: "No parents linked."
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        allAction: "Push all",
        rowAction: "Push",
        running: "Pushing to Onshape...",
        description:
            "Workspaces that reference this one. Pushing creates a version here and moves their references onto it.",
        empty: "No children linked."
    }
} as const;

/** What a run can be aimed at: everything in a direction, or one link. */
const ALL_TARGET = "all";

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
 */
export interface LinkActions {
    isRunning: boolean;
    /** What the run going is aimed at: {@link ALL_TARGET} or a link's id. */
    activeTarget: string | undefined;
    runAll: (recursive: boolean) => void;
    runOne: (linked: LinkedWorkspace, recursive: boolean) => void;
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

    /**
     * A push runs on the click or asks for a name first, which the navbar's
     * checkbox decides. Read at the click rather than subscribed to: nothing
     * here re-renders when it changes.
     */
    const startPush = (scope: PushScope, title: string, targets: string[]) => {
        if (getUiState().isQuickPush) {
            push.mutate({ scope });
            return;
        }
        openPushVersionModal(workspace, {
            scope,
            title,
            targets,
            recursive:
                scope.kind === PushScopeKind.DESCENDANTS ||
                (scope.kind === PushScopeKind.ONE && scope.recursive)
        });
    };

    return {
        isRunning,
        // Derived rather than cleared when the run ends: clearing would be a
        // state write from an effect, and a stale target simply goes unused.
        activeTarget: isRunning ? startedTarget : undefined,
        runAll: (recursive) => {
            setStartedTarget(ALL_TARGET);
            if (!isChild) {
                pull.mutate({ kind: PullScopeKind.PARENTS });
                return;
            }
            startPush(
                {
                    kind: recursive
                        ? PushScopeKind.DESCENDANTS
                        : PushScopeKind.CHILDREN
                },
                recursive ? "Recursive push" : "Push to every child",
                linked.map(toName)
            );
        },
        runOne: (each, recursive) => {
            setStartedTarget(each.linkId);
            if (!isChild) {
                pull.mutate({
                    kind: PullScopeKind.ONE,
                    workspace: each.workspace
                });
                return;
            }
            startPush(
                {
                    kind: PushScopeKind.ONE,
                    workspace: each.workspace,
                    recursive
                },
                `Push to ${toName(each)}`,
                [toName(each)]
            );
        },
        updateAllReferences: () => {
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

    return (
        <>
            <ActionButton
                direction={direction}
                label={copy.allAction}
                loading={activeTarget === ALL_TARGET}
                disabled={isRunning || linked.length === 0}
                onClick={() => actions.runAll(false)}
            />
            <MenuButton>
                {isChild ? (
                    <MenuSection label="Push">
                        <Menu.Item
                            leftSection={
                                <TreeStructureIcon size={IconSize.MEDIUM} />
                            }
                            disabled={isRunning || linked.length === 0}
                            onClick={() => actions.runAll(true)}
                        >
                            Recursive push
                        </Menu.Item>
                    </MenuSection>
                ) : (
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
            <Text size="sm" c={StatusColor.DIMMED}>
                {copy.description}
            </Text>
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
            <MenuSection label={copy.rowAction}>
                <Menu.Item
                    leftSection={
                        <DirectionIcon
                            direction={direction}
                            size={IconSize.MEDIUM}
                        />
                    }
                    disabled={disabled}
                    onClick={() => actions.runOne(linked, false)}
                >
                    {copy.rowAction}
                </Menu.Item>
                {/* No recursive pull: a pull writes only to this workspace, and
                    going further would mean versioning a parent's own parents,
                    which is a push and theirs to make. */}
                {isChild && (
                    <Menu.Item
                        leftSection={
                            <TreeStructureIcon size={IconSize.MEDIUM} />
                        }
                        disabled={disabled}
                        onClick={() => actions.runOne(linked, true)}
                    >
                        Recursive push
                    </Menu.Item>
                )}
            </MenuSection>
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
            onClick={linked.isOpenable ? () => openUrlInNewTab(url) : undefined}
            rightSection={
                <ActionButton
                    direction={direction}
                    label={copy.rowAction}
                    loading={actions.activeTarget === linked.linkId}
                    disabled={disabled}
                    forbidden={!allowed}
                    onClick={() => actions.runOne(linked, false)}
                />
            }
        />
    );
}

/** What a link the caller has no permission on says, in place of its name. */
function MissingAccess(props: { size?: "sm" | "xs" }): ReactNode {
    const { size = "xs" } = props;
    return (
        <Group gap={4} wrap="nowrap" miw={0}>
            <ProhibitIcon
                size={size === "sm" ? IconSize.MEDIUM : IconSize.TINY}
                color={`var(--mantine-color-${StatusColor.ERROR}-filled)`}
            />
            <Text size={size} c={StatusColor.ERROR}>
                Missing access
            </Text>
        </Group>
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
                <MissingAccess size="sm" />
            </Group>
        );
    }

    // Readable but unnamed: the document answered, and had nothing to say.
    const documentName = linked.documentName ?? "Untitled document";

    return (
        <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
            <FileIcon size={IconSize.MEDIUM} color={StatusColor.DIMMED} />
            <Stack gap={0} miw={0}>
                <TruncatedText hoverText={documentName} size="sm">
                    {documentName}
                </TruncatedText>
                {/* Readable but not writable, which only a push runs into. */}
                {!allowed ? (
                    <MissingAccess />
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
