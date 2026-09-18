import { ActionIcon, Group, Menu, Stack, Text, Tooltip } from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowSquareOutIcon,
    LinkBreakIcon,
    WarningIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    LinkDirection,
    type LinkedWorkspace,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { ItemRow, ItemTable } from "../../../components/item-row";
import { MenuSection } from "../../../components/app-menu";
import { Section } from "../../../components/section";
import { SectionNotice } from "../../../components/app-zero-state";
import { TruncatedText } from "../../../components/truncated-text";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import { useIsVersionJobRunning, useRemoveLinkMutation } from "../queries";
import { AddLinkInput } from "./add-link-input";

interface LinkedWorkspaceListProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    title: string;
    /** What linking in this direction does, shown above the list. */
    description: string;
    linked: LinkedWorkspace[];
    emptyMessage: string;
    /** Runs this row's own push or pull; see {@link QuickActionButton}. */
    onQuickAction: (linked: LinkedWorkspace) => void;
}

/** One direction's links, with the input that adds another. */
export function LinkedWorkspaceList(
    props: LinkedWorkspaceListProps
): ReactNode {
    const {
        workspace,
        direction,
        title,
        description,
        linked,
        emptyMessage,
        onQuickAction
    } = props;
    const removeLink = useRemoveLinkMutation(workspace);
    const isRunning = useIsVersionJobRunning(workspace);

    return (
        <Section title={title}>
            <Text size="sm" c={StatusColor.DIMMED}>
                {description}
            </Text>
            <AddLinkInput workspace={workspace} direction={direction} />
            {linked.length === 0 ? (
                <SectionNotice
                    title={emptyMessage}
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
                            isRunning={isRunning}
                            onRemove={() => removeLink.mutate(each.linkId)}
                            onQuickAction={() => onQuickAction(each)}
                        />
                    ))}
                </ItemTable>
            )}
        </Section>
    );
}

interface LinkedWorkspaceRowProps {
    linked: LinkedWorkspace;
    direction: LinkDirection;
    /** A run is already going, and a second one would race it. */
    isRunning: boolean;
    onRemove: () => void;
    onQuickAction: () => void;
}

function LinkedWorkspaceRow(props: LinkedWorkspaceRowProps): ReactNode {
    const { linked, direction, isRunning, onRemove, onQuickAction } = props;
    const url = makeUrl(linked.workspace);
    const isPush = direction === LinkDirection.DOWNSTREAM;

    const menuItems = (
        <MenuSection label="Link">
            <Menu.Item
                leftSection={
                    isPush ? (
                        <ArrowLineUpIcon size={IconSize.MEDIUM} />
                    ) : (
                        <ArrowLineDownIcon size={IconSize.MEDIUM} />
                    )
                }
                disabled={isRunning || !canAct(linked, isPush)}
                onClick={onQuickAction}
            >
                {isPush ? "Push to this workspace" : "Pull from this workspace"}
            </Menu.Item>
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
            onClick={linked.isOpenable ? () => openUrlInNewTab(url) : undefined}
            rightSection={
                <QuickActionButton
                    linked={linked}
                    isPush={isPush}
                    isRunning={isRunning}
                    onClick={onQuickAction}
                />
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

interface QuickActionButtonProps {
    linked: LinkedWorkspace;
    isPush: boolean;
    isRunning: boolean;
    onClick: () => void;
}

/**
 * This row's own push or pull, for moving one link rather than all of them.
 *
 * A pull runs on the click; a push opens the version form first, because a
 * version cannot be cut without a name.
 */
function QuickActionButton(props: QuickActionButtonProps): ReactNode {
    const { linked, isPush, isRunning, onClick } = props;
    const disabled = isRunning || !canAct(linked, isPush);

    const label = isPush
        ? "Push a version to this workspace"
        : "Pull this workspace's latest version";

    return (
        <Tooltip
            withArrow
            label={
                disabled && !isRunning
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
