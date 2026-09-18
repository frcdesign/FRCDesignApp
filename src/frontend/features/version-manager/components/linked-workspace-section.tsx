import {
    ActionIcon,
    Checkbox,
    Group,
    Menu,
    Stack,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowSquareOutIcon,
    ArrowsClockwiseIcon,
    CaretDownIcon,
    LinkBreakIcon,
    PencilSimpleIcon,
    WarningIcon
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    type LinkedWorkspace,
    type PushScope,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppContextMenu, MenuSection } from "../../../components/app-menu";
import { ItemRow, ItemTable } from "../../../components/item-row";
import { SectionNotice } from "../../../components/app-zero-state";
import { TruncatedText } from "../../../components/truncated-text";
import { IconSize, StatusColor } from "../../../lib/style-constants";
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
const COPY = {
    [LinkDirection.PARENT]: {
        title: "Parents",
        description:
            "Workspaces this one references. Pulling moves this workspace's references onto their latest versions.",
        groupAction: "Pull from every parent",
        rowAction: "Pull from this parent",
        empty: "No parents linked."
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        description:
            "Workspaces that reference this one. Pushing creates a version here and moves their references onto it.",
        groupAction: "Push to every child",
        rowAction: "Push to this child",
        empty: "No children linked."
    }
} as const;

interface LinkedWorkspaceSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
}

/**
 * One direction's links: the action for all of them in the title, one per row,
 * and the field that adds another underneath.
 *
 * Every action runs on the click — a push takes the default version name, since
 * naming one is not what somebody wanting their change downstream came here to
 * do. The caret beside each button is where naming it lives.
 */
export function LinkedWorkspaceSection(
    props: LinkedWorkspaceSectionProps
): ReactNode {
    const { workspace, direction, linked } = props;
    const [recursive, setRecursive] = useState(false);
    const pull = usePullReferencesMutation(workspace);
    const push = usePushVersionMutation(workspace);
    const removeLink = useRemoveLinkMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    const isChild = direction === LinkDirection.CHILD;
    const copy = COPY[direction];
    const groupScope: PushScope = { kind: recursive ? "recursive" : "direct" };

    const runGroupAction = () => {
        if (isChild) {
            push.mutate({ scope: groupScope });
        } else {
            pull.mutate({ kind: "parents" });
        }
    };

    const runRowAction = (each: LinkedWorkspace) => {
        if (isChild) {
            push.mutate({ scope: { kind: "one", workspace: each.workspace } });
        } else {
            pull.mutate({ kind: "one", workspace: each.workspace });
        }
    };

    const groupMenuItems = isChild ? (
        <MenuSection label="Push">
            <Menu.Item
                leftSection={<PencilSimpleIcon size={IconSize.MEDIUM} />}
                disabled={isRunning}
                onClick={() =>
                    openPushVersionModal(workspace, {
                        scope: groupScope,
                        title: "Push to every child",
                        targets: toNames(linked),
                        recursive
                    })
                }
            >
                Name this version...
            </Menu.Item>
        </MenuSection>
    ) : (
        <MenuSection label="Pull">
            {/* Every out-of-date reference, linked or not, which is the one
                thing the parent list cannot express. */}
            <Menu.Item
                leftSection={<ArrowsClockwiseIcon size={IconSize.MEDIUM} />}
                disabled={isRunning}
                onClick={() => pull.mutate({ kind: "all" })}
            >
                Update all references
            </Menu.Item>
        </MenuSection>
    );

    return (
        <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap" gap="xs">
                <Title order={3}>{copy.title}</Title>
                <Group gap={4} wrap="nowrap">
                    {isChild && (
                        <Tooltip
                            withArrow
                            label="Carry the push on past the children, versioning each workspace on the way"
                        >
                            <Checkbox
                                size="xs"
                                label="Recursive"
                                checked={recursive}
                                onChange={(event) =>
                                    setRecursive(event.currentTarget.checked)
                                }
                            />
                        </Tooltip>
                    )}
                    <ActionButton
                        isPush={isChild}
                        label={copy.groupAction}
                        disabled={isRunning || linked.length === 0}
                        onClick={runGroupAction}
                    />
                    <CaretMenu menuItems={groupMenuItems} label={copy.title} />
                </Group>
            </Group>
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
                            isPush={isChild}
                            actionLabel={copy.rowAction}
                            isRunning={isRunning}
                            onAction={() => runRowAction(each)}
                            onConfigure={() =>
                                openPushVersionModal(workspace, {
                                    scope: {
                                        kind: "one",
                                        workspace: each.workspace
                                    },
                                    title: `Push to ${toName(each)}`,
                                    targets: toNames([each]),
                                    recursive: false
                                })
                            }
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

function toNames(linked: LinkedWorkspace[]): string[] {
    return linked.map(toName);
}

interface LinkedWorkspaceRowProps {
    linked: LinkedWorkspace;
    isPush: boolean;
    actionLabel: string;
    /** A run is already going, and a second one would race it. */
    isRunning: boolean;
    onAction: () => void;
    onConfigure: () => void;
    onRemove: () => void;
}

function LinkedWorkspaceRow(props: LinkedWorkspaceRowProps): ReactNode {
    const {
        linked,
        isPush,
        actionLabel,
        isRunning,
        onAction,
        onConfigure,
        onRemove
    } = props;
    const url = makeUrl(linked.workspace);

    const menuItems = (
        <MenuSection label="Link">
            {isPush && (
                <Menu.Item
                    leftSection={<PencilSimpleIcon size={IconSize.MEDIUM} />}
                    disabled={isRunning || !canAct(linked, isPush)}
                    onClick={onConfigure}
                >
                    Name this version...
                </Menu.Item>
            )}
            {linked.isOpenable && (
                <Menu.Item
                    leftSection={<ArrowSquareOutIcon size={IconSize.MEDIUM} />}
                    onClick={() => openUrlInNewTab(url)}
                >
                    Open in Onshape
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
    );

    return (
        <ItemRow
            left={<LinkedWorkspaceTitle linked={linked} />}
            menuItems={menuItems}
            // The caret below carries the same menu, so the row needs no second
            // button for it.
            moreButton={false}
            onClick={linked.isOpenable ? () => openUrlInNewTab(url) : undefined}
            rightSection={
                <Group gap={2} wrap="nowrap">
                    <ActionButton
                        isPush={isPush}
                        label={actionLabel}
                        disabled={isRunning || !canAct(linked, isPush)}
                        forbidden={!canAct(linked, isPush)}
                        onClick={onAction}
                    />
                    <CaretMenu menuItems={menuItems} label={toName(linked)} />
                </Group>
            }
        />
    );
}

/**
 * Whether this row can be acted on at all: a push writes to the linked
 * workspace, so it needs the permissions Onshape reported for it; a pull only
 * reads it, which being openable already establishes.
 */
function canAct(linked: LinkedWorkspace, isPush: boolean): boolean {
    return isPush ? linked.canPush : linked.isOpenable;
}

interface ActionButtonProps {
    isPush: boolean;
    label: string;
    disabled: boolean;
    /** Disabled because Onshape says no, rather than because a run is going. */
    forbidden?: boolean;
    onClick: () => void;
}

/** The push or pull itself, which runs on the click. */
function ActionButton(props: ActionButtonProps): ReactNode {
    const { isPush, label, disabled, forbidden = false, onClick } = props;

    return (
        <Tooltip
            withArrow
            label={
                forbidden
                    ? "You do not have permission to do this in Onshape."
                    : label
            }
        >
            {/* A span, so the tooltip still has something to hang off when the
                button inside it is disabled and stops firing events. */}
            <span>
                <ActionIcon
                    variant="subtle"
                    color={StatusColor.NEUTRAL}
                    aria-label={label}
                    disabled={disabled}
                    onClick={(event) => {
                        // The row itself opens Onshape; this button does not.
                        event.stopPropagation();
                        onClick();
                    }}
                >
                    {isPush ? (
                        <ArrowLineUpIcon size={IconSize.MEDIUM} />
                    ) : (
                        <ArrowLineDownIcon size={IconSize.MEDIUM} />
                    )}
                </ActionIcon>
            </span>
        </Tooltip>
    );
}

interface CaretMenuProps {
    menuItems: ReactNode;
    /** What the menu is about, for the button's accessible name. */
    label: string;
}

/** The options behind the action button, opened by the caret beside it. */
function CaretMenu(props: CaretMenuProps): ReactNode {
    const { menuItems, label } = props;
    return (
        <AppContextMenu controlledByButton menuItems={menuItems}>
            <ActionIcon
                variant="subtle"
                color={StatusColor.NEUTRAL}
                aria-label={`${label} options`}
                onClick={(event) => event.stopPropagation()}
            >
                <CaretDownIcon size={IconSize.SMALL} />
            </ActionIcon>
        </AppContextMenu>
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
        <Stack gap={0} miw={0} flex={1}>
            <TruncatedText hoverText={documentName} size="sm">
                {documentName}
            </TruncatedText>
            {linked.workspaceName && (
                <Text size="xs" c={StatusColor.DIMMED} truncate>
                    {linked.workspaceName}
                </Text>
            )}
        </Stack>
    );
}
