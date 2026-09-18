import { Button, Group, Menu, Stack, Text } from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowsClockwiseIcon,
    ArrowSquareOutIcon,
    FileIcon,
    LinkBreakIcon,
    PencilSimpleIcon,
    TreeStructureIcon,
    WarningIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
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
        quickAction: "Quick pull",
        description:
            "Workspaces this one references. Pulling moves this workspace's references onto their latest versions.",
        empty: "No parents linked."
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        quickAction: "Quick push",
        description:
            "Workspaces that reference this one. Pushing creates a version here and moves their references onto it.",
        empty: "No children linked."
    }
} as const;

/** The arrow a direction is marked with, in its title and on its actions. */
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

interface QuickActionButtonProps {
    direction: LinkDirection;
    disabled: boolean;
    onClick: () => void;
}

/**
 * The button on a section's header: pushes or pulls everything in it, with no
 * version to name and nothing to confirm, which is what nearly every use of
 * this page is.
 */
export function QuickActionButton(props: QuickActionButtonProps): ReactNode {
    const { direction, disabled, onClick } = props;
    return (
        <Button
            size="compact-sm"
            variant="light"
            leftSection={
                <DirectionIcon direction={direction} size={IconSize.SMALL} />
            }
            // The title beside it is what gives on a narrow panel; a label
            // reading "Quick" is worse than a truncated document name.
            style={NO_SHRINK}
            disabled={disabled}
            onClick={onClick}
        >
            {DIRECTION_COPY[direction].quickAction}
        </Button>
    );
}

interface LinkedWorkspaceSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
}

/**
 * One direction's links, and the field that adds another underneath them.
 *
 * Every action runs on the click — a push takes the name Onshape's own dialog
 * would give it, since naming a version is not what somebody wanting their
 * change downstream came here to do. Naming one lives in a menu.
 */
export function LinkedWorkspaceSection(
    props: LinkedWorkspaceSectionProps
): ReactNode {
    const { workspace, direction, linked } = props;
    const removeLink = useRemoveLinkMutation(workspace);
    const actions = useLinkActions(workspace, direction);
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

/**
 * Everything a section and its rows can set running, in one place so the header
 * outside the accordion panel and the rows inside it drive the same mutations.
 */
export interface LinkActions {
    isRunning: boolean;
    /** Push to, or pull from, everything in this direction. */
    quickAll: () => void;
    /** The same for one linked workspace. */
    quickOne: (linked: LinkedWorkspace) => void;
    /** Children only: carry the push on past them. */
    recursiveAll: () => void;
    recursiveOne: (linked: LinkedWorkspace) => void;
    /** Children only: name the version first. */
    nameAll: (linked: LinkedWorkspace[]) => void;
    nameOne: (linked: LinkedWorkspace) => void;
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
    const isChild = direction === LinkDirection.CHILD;

    const one = (linked: LinkedWorkspace, recursive: boolean) => {
        if (isChild) {
            push.mutate({
                scope: {
                    kind: PushScopeKind.ONE,
                    workspace: linked.workspace,
                    recursive
                }
            });
        } else {
            pull.mutate({
                kind: PullScopeKind.ONE,
                workspace: linked.workspace
            });
        }
    };

    return {
        isRunning,
        quickAll: () => {
            if (isChild) {
                push.mutate({ scope: { kind: PushScopeKind.CHILDREN } });
            } else {
                pull.mutate({ kind: PullScopeKind.PARENTS });
            }
        },
        quickOne: (linked) => one(linked, false),
        recursiveAll: () =>
            push.mutate({ scope: { kind: PushScopeKind.DESCENDANTS } }),
        recursiveOne: (linked) => one(linked, true),
        nameAll: (linked) =>
            openPushVersionModal(workspace, {
                scope: { kind: PushScopeKind.CHILDREN },
                title: "Push to every child",
                targets: linked.map(toName),
                recursive: false
            }),
        nameOne: (linked) =>
            openPushVersionModal(workspace, {
                scope: {
                    kind: PushScopeKind.ONE,
                    workspace: linked.workspace,
                    recursive: false
                },
                title: `Push to ${toName(linked)}`,
                targets: [toName(linked)],
                recursive: false
            }),
        updateAllReferences: () => pull.mutate({ kind: PullScopeKind.ALL })
    };
}

interface SectionMenuProps {
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    actions: LinkActions;
}

/** The section's own options, beside its quick button. */
export function SectionMenu(props: SectionMenuProps): ReactNode {
    const { direction, linked, actions } = props;
    const { isRunning } = actions;
    const disabled = isRunning || linked.length === 0;

    if (direction === LinkDirection.PARENT) {
        return (
            <MenuButton>
                <MenuSection label="Pull">
                    {/* Every out-of-date reference, linked or not, which is the
                        one thing the parent list cannot express. */}
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
            </MenuButton>
        );
    }

    return (
        <MenuButton>
            <MenuSection label="Push">
                <Menu.Item
                    leftSection={<TreeStructureIcon size={IconSize.MEDIUM} />}
                    disabled={disabled}
                    onClick={actions.recursiveAll}
                >
                    Recursive push
                </Menu.Item>
                <Menu.Item
                    leftSection={<PencilSimpleIcon size={IconSize.MEDIUM} />}
                    disabled={isRunning}
                    onClick={() => actions.nameAll(linked)}
                >
                    Push with a name...
                </Menu.Item>
            </MenuSection>
        </MenuButton>
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
}

function LinkedWorkspaceRow(props: LinkedWorkspaceRowProps): ReactNode {
    const { linked, direction, actions, onRemove } = props;
    const url = makeUrl(linked.workspace);
    const isChild = direction === LinkDirection.CHILD;
    // A push writes to the linked workspace, so it needs the permissions
    // Onshape reported for it; a pull only reads it, which being openable
    // already establishes.
    const canAct = isChild ? linked.canPush : linked.isOpenable;
    const disabled = actions.isRunning || !canAct;

    const menuItems = (
        <>
            <MenuSection label={isChild ? "Push" : "Pull"}>
                <Menu.Item
                    leftSection={
                        <DirectionIcon
                            direction={direction}
                            size={IconSize.MEDIUM}
                        />
                    }
                    disabled={disabled}
                    onClick={() => actions.quickOne(linked)}
                >
                    {DIRECTION_COPY[direction].quickAction}
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
                        onClick={() => actions.recursiveOne(linked)}
                    >
                        Recursive push
                    </Menu.Item>
                )}
                {isChild && (
                    <Menu.Item
                        leftSection={
                            <PencilSimpleIcon size={IconSize.MEDIUM} />
                        }
                        disabled={disabled}
                        onClick={() => actions.nameOne(linked)}
                    >
                        Push with a name...
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
            left={<LinkedWorkspaceTitle linked={linked} />}
            menuItems={menuItems}
            onClick={linked.isOpenable ? () => openUrlInNewTab(url) : undefined}
        />
    );
}

/**
 * The document and workspace a link points at. A link the caller cannot read
 * shows that it exists and nothing else: what it points at is not theirs to
 * know, and the row is still theirs to remove.
 */
function LinkedWorkspaceTitle(props: { linked: LinkedWorkspace }): ReactNode {
    const { linked } = props;

    if (!linked.isOpenable) {
        return (
            <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
                <WarningIcon
                    size={IconSize.MEDIUM}
                    color={StatusColor.WARNING}
                />
                <Text size="sm" c={StatusColor.DIMMED}>
                    A document you cannot open
                </Text>
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
                {linked.workspaceName && (
                    <Text size="xs" c={StatusColor.DIMMED} truncate>
                        {linked.workspaceName}
                    </Text>
                )}
            </Stack>
        </Group>
    );
}
