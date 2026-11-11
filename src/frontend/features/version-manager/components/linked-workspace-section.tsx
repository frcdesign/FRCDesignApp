import { Center, Divider, Loader, Menu, Text, Tooltip } from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    ArrowsClockwiseIcon,
    ArrowsDownUpIcon,
    ArrowSquareOutIcon,
    LinkBreakIcon,
    TreeStructureIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    LinkDirection,
    workspaceThumbnailUrl,
    type LinkedWorkspace,
    type SuggestedLink,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { ThumbnailSize } from "@backend/features/thumbnails/contract";
import { MenuButton, MenuSection } from "../../../components/app-menu";
import { RowActionButton } from "../../../components/row-action-button";
import { m } from "../../../paraglide/messages";
import { InfoTooltip } from "../../../components/info-tooltip";
import { openDeleteConfirm } from "../../../components/alerts";
import { CardTitle, ItemRow, ItemTable } from "../../../components/item-row";
import { SectionNotice } from "../../../components/app-notice";
import { ChangesBadge } from "../../../components/changes-badge";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import {
    IconSize,
    PrimaryColor,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import styles from "../../../lib/styles.module.css";
import {
    useOnshapeOrigin,
    useTargetWorkspace
} from "../../../lib/onshape-params";
import { runningHeadline } from "../job-report";
import {
    useMoveLinkMutation,
    useRemoveLinkMutation,
    useWorkspaceChangesQuery
} from "../queries";
import { AddLinkRow } from "./add-link-input";
import {
    LinkSuggestionsMenuSection,
    SuggestedLinkRows
} from "./link-suggestions";
import { documentLabel } from "../document-label";
import { DIRECTION_COPY } from "../direction-copy";
import { type LinkActions } from "../link-actions";

/** The other side of the list a link is in, which is where a move sends it. */
const OTHER_DIRECTION = {
    [LinkDirection.PARENT]: LinkDirection.CHILD,
    [LinkDirection.CHILD]: LinkDirection.PARENT
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

interface SectionActionsProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    /** Parents only, each offered beside the links. */
    suggestions: SuggestedLink[];
    actions: LinkActions;
}

/** The whole section's actions, which sit in its header as a menu. */
export function SectionActions(props: SectionActionsProps): ReactNode {
    const { workspace, direction, linked, suggestions, actions } = props;
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
                <LinkSuggestionsMenuSection
                    workspace={workspace}
                    suggestions={suggestions}
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
        <MenuSection
            label={
                isChild
                    ? m.versionManagerMenuPush()
                    : m.versionManagerMenuPull()
            }
        >
            <Menu.Item
                leftSection={<DirectionIcon direction={direction} />}
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
                {isChild
                    ? m.versionManagerQuickRecursivePush()
                    : m.versionManagerQuickRecursivePull()}
            </Menu.Item>
            <Menu.Item
                leftSection={<ArrowsClockwiseIcon size={IconSize.MEDIUM} />}
                disabled={updateDisabled}
                onClick={onUpdate}
            >
                {linked
                    ? m.versionManagerUpdateReferences()
                    : m.versionManagerUpdateAllReferences()}
            </Menu.Item>
        </MenuSection>
    );
}

interface LinkedWorkspaceSectionProps {
    workspace: WorkspacePath;
    direction: LinkDirection;
    linked: LinkedWorkspace[];
    /** Parents only, listed after the links. */
    suggestions: SuggestedLink[];
    actions: LinkActions;
}

/** One direction's links, any suggestions, and the field that adds another underneath them. */
export function LinkedWorkspaceSection(
    props: LinkedWorkspaceSectionProps
): ReactNode {
    const { workspace, direction, linked, suggestions, actions } = props;
    const removeLink = useRemoveLinkMutation(workspace);
    const moveLink = useMoveLinkMutation(workspace);
    const copy = DIRECTION_COPY[direction];

    return (
        <>
            {linked.length === 0 && suggestions.length === 0 && (
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
                <SuggestedLinkRows
                    workspace={workspace}
                    suggestions={suggestions}
                />
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
            <MenuSection label={m.versionManagerMenuLink()}>
                {linked.isOpenable && (
                    <Menu.Item
                        color={StatusColor.INFO}
                        leftSection={
                            <ArrowSquareOutIcon size={IconSize.MEDIUM} />
                        }
                        onClick={() => openUrlInNewTab(url)}
                    >
                        {m.versionManagerOpenDocument()}
                    </Menu.Item>
                )}
                <Menu.Item
                    leftSection={<ArrowsDownUpIcon size={IconSize.MEDIUM} />}
                    onClick={onMove}
                >
                    {direction === LinkDirection.PARENT
                        ? m.versionManagerSwitchToChild()
                        : m.versionManagerSwitchToParent()}
                </Menu.Item>
                <Menu.Item
                    color={StatusColor.ERROR}
                    leftSection={<LinkBreakIcon size={IconSize.MEDIUM} />}
                    onClick={() =>
                        openDeleteConfirm({
                            title: m.versionManagerRemoveLink(),
                            // Unnamed where the caller can't open it.
                            text:
                                linked.documentName === undefined
                                    ? m.versionManagerRemoveLinkConfirmUnnamed()
                                    : m.versionManagerRemoveLinkConfirm({
                                          document: linked.documentName
                                      }),
                            confirmLabel: m.versionManagerRemoveLink(),
                            onConfirm: onRemove
                        })
                    }
                >
                    {m.versionManagerRemoveLink()}
                </Menu.Item>
            </MenuSection>
        </>
    );

    return (
        <ItemRow
            left={
                <LinkedWorkspaceTitle
                    linked={linked}
                    isParent={direction === LinkDirection.PARENT}
                />
            }
            menuItems={menuItems}
            // Its own menu button, so the spinner comes before it.
            moreButton={false}
            onClick={() => {
                if (!running && linked.isOpenable) {
                    actions.openOne(linked);
                }
            }}
            rightSection={
                <>
                    {running && actions.isRunningFor(linked) && (
                        <RunningIndicator status={running} />
                    )}
                    {linked.isOpenable && (
                        <RowActionButton
                            label={
                                direction === LinkDirection.CHILD
                                    ? m.versionManagerRowPush()
                                    : m.versionManagerRowPull()
                            }
                            icon={<DirectionIcon direction={direction} />}
                            disabledReason={
                                running
                                    ? m.versionManagerRowRunning()
                                    : undefined
                            }
                            onClick={() => actions.quickOne(linked, false)}
                        />
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
    /** A parent's row counts its unversioned edits, which a pull versions. */
    isParent: boolean;
}

/** The document and workspace a link points at; only that it exists, if unreadable. */
function LinkedWorkspaceTitle(props: LinkedWorkspaceTitleProps): ReactNode {
    const { linked, isParent } = props;
    const thumbnail = <LinkedWorkspaceThumbnail linked={linked} />;

    if (!linked.isOpenable) {
        return (
            <CardTitle
                title={m.versionManagerMissingAccess()}
                thumbnail={thumbnail}
                titleColor={StatusColor.ERROR}
                subtitle={
                    <Text size="xs" c={StatusColor.ERROR} truncate>
                        {m.versionManagerMissingAccessDescription()}
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
                isParent && (
                    <UnversionedChangesBadge parent={linked.workspace} />
                )
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
    parent: WorkspacePath;
}

/** What the parent has changed since its own last version, which a pull versions. */
function UnversionedChangesBadge(
    props: UnversionedChangesBadgeProps
): ReactNode {
    const workspace = useTargetWorkspace();
    const changesQuery = useWorkspaceChangesQuery(workspace, props.parent);
    const changes = changesQuery.data?.changes;
    if (!changes) {
        return null;
    }
    return <ChangesBadge changes={changes} />;
}
