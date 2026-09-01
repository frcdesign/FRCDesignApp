import { Anchor, Group, Menu, Stack, Table, Text } from "@mantine/core";
import {
    ArrowSquareOutIcon,
    EyeSlashIcon,
    GearIcon,
    LinkIcon,
    PlusIcon
} from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { meaningfulPartNumber } from "@backend/features/configurations/part-number";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../../../lib/url";
import { PropsWithChildren, ReactNode, useCallback } from "react";
import { AppContextMenu, MenuButton } from "../../../components/app-menu";
import { type Position, SearchHit } from "../../search/search";
import {
    HighlightedText,
    SearchHitTitle
} from "../../search/components/search-results";
import {
    ConfigurablePath,
    DocumentPath,
    InstancePath
} from "@backend/lib/onshape/path";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import {
    useInsertMutation,
    useIsAssemblyInPartStudio
} from "../../insert/insert-hooks";
import { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";

import { ParameterValues } from "@backend/features/configurations/models";
import { useSearch } from "@tanstack/react-router";
import { RequireAccessLevel } from "../../auth/access-level";
import { AppIcon } from "../../../components/app-icon";

interface OpenDocumentItemsProps {
    /** Any Onshape path; a shell group's stops at the document. */
    path: DocumentPath | InstancePath | ConfigurablePath;
}
/**
 * Menu items which can be used to open or copy a link to a document.
 */
export function OpenDocumentItems(props: OpenDocumentItemsProps) {
    const url = makeUrl(props.path);
    return (
        <>
            <Menu.Item
                leftSection={<ArrowSquareOutIcon size={IconSize.SMALL} />}
                onClick={() => openUrlInNewTab(url)}
            >
                Open document
            </Menu.Item>
            <Menu.Item
                leftSection={<LinkIcon size={IconSize.SMALL} />}
                onClick={() => {
                    void copyUrlToClipboard(url);
                }}
            >
                Copy link
            </Menu.Item>
        </>
    );
}

interface QuickInsertItemProps {
    insertable: InsertableOut;
    configuration?: ParameterValues;
    isFavorite: boolean;
}

/**
 * Menu items which can be used to quick insert a document.
 */
export function QuickInsertItems(props: QuickInsertItemProps) {
    const { insertable, configuration, isFavorite } = props;
    const search = useSearch({ from: "/app" });

    const insertMutation = useInsertMutation(insertable, configuration, {
        isFavorite,
        isQuickInsert: true
    });
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    const handleClick = useCallback(
        (fasten: boolean) => {
            if (isAssemblyInPartStudio) {
                openCannotDeriveAssemblyAlert();
                return;
            }
            insertMutation.mutate(fasten);
        },
        [isAssemblyInPartStudio, insertMutation]
    );

    const supportsFasten =
        insertable.supportsFasten &&
        search.elementType === ElementType.ASSEMBLY;

    return (
        <>
            {supportsFasten && (
                <Menu.Item
                    leftSection={<PlusIcon size={IconSize.SMALL} />}
                    onClick={() => handleClick(true)}
                >
                    Quick insert and fasten
                </Menu.Item>
            )}
            <Menu.Item
                leftSection={<PlusIcon size={IconSize.SMALL} />}
                onClick={() => handleClick(false)}
            >
                Quick insert
            </Menu.Item>
        </>
    );
}

interface CardTitleProps {
    /**
     * True to use disabled text styles.
     * @default false
     */
    disabled?: boolean;

    /**
     * @default false
     */
    showHiddenTag?: boolean;
    /**
     * The title to display.
     * Ignored if SearchHit is provided.
     */
    title: string;
    searchHit?: SearchHit;
    /** The row's `CardThumbnail`, which only the caller knows how to address. */
    thumbnail: ReactNode;
    /** Optional build-status badge rendered after the title. */
    buildStatusBadge?: ReactNode;
}

export function CardTitle(props: CardTitleProps) {
    const {
        searchHit,
        title,
        thumbnail,
        buildStatusBadge,
        disabled = false,
        showHiddenTag = false
    } = props;

    let cardTitle: ReactNode;
    if (searchHit) {
        cardTitle = <SearchHitTitle title={title} searchHit={searchHit} />;
    } else {
        cardTitle = title;
    }

    // Shrinks to truncate, but never grows: the build status badge and hidden tag belong beside the name, not at the row's edge.
    const cardTitleComponent = (
        <Stack gap={0} miw={0}>
            <Text size="sm" truncate c={disabled ? "dimmed" : undefined}>
                {cardTitle}
            </Text>
            {/* The line under the title, so it sits beside it in the stack
                rather than inside the paragraph the title renders as. */}
            <PartNameAndNumber title={title} searchHit={searchHit} />
        </Stack>
    );

    return (
        <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
            {thumbnail}
            {cardTitleComponent}
            {buildStatusBadge}
            {/* After the badge: toggling visibility would otherwise shift the
                badge, dragging its open hover card out from under the cursor. */}
            {showHiddenTag && (
                <AppIcon
                    icon={EyeSlashIcon}
                    size={IconSize.SMALL}
                    color={StatusColor.WARNING}
                    label="Hidden"
                />
            )}
        </Group>
    );
}

interface PartNameAndNumberProps {
    /** The row's own title, which neither line repeats. */
    title: string;
    searchHit?: SearchHit;
}

/** The matched configuration's name and part number, beneath the title. */
function PartNameAndNumber(props: PartNameAndNumberProps): ReactNode {
    const { title, searchHit } = props;

    // The hit's best-matching configuration, minus a value repeating the title.
    const partName =
        searchHit?.partName?.toLowerCase() !== title.toLowerCase()
            ? searchHit?.partName
            : undefined;
    const partNumber = meaningfulPartNumber(searchHit?.partNumber, title);

    if (!partName && !partNumber) {
        return null;
    }

    return (
        <Group
            gap={4}
            wrap="nowrap"
            miw={0}
            fz="xs"
            lh="xs"
            c={StatusColor.DIMMED}
        >
            {partName && (
                <Text inherit truncate miw={0}>
                    <HighlightedText
                        text={partName}
                        positions={searchHit?.partNamePositions}
                    />
                </Text>
            )}
            {partName && partNumber && <Text inherit>·</Text>}
            {partNumber && (
                <CardPartNumber
                    partNumber={partNumber}
                    positions={searchHit?.partNumberPositions}
                    url={searchHit?.url}
                />
            )}
        </Group>
    );
}

/** The part number, linked to the vendor's page for it when there is one. */
function CardPartNumber(props: {
    partNumber: string;
    positions?: Position[];
    url?: string;
}): ReactNode {
    const { partNumber, positions, url } = props;
    const text = <HighlightedText text={partNumber} positions={positions} />;
    if (!url) {
        return (
            <Text
                inherit
                truncate
                miw={0}
                style={{ flexShrink: 0, maxWidth: "100%" }}
            >
                {text}
            </Text>
        );
    }
    return (
        <Anchor
            href={url}
            target="_blank"
            inherit
            // The row inserts on click, which is not what the link is for.
            onClick={(event) => event.stopPropagation()}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                minWidth: 0,
                flexShrink: 0,
                maxWidth: "100%"
            }}
        >
            <Text component="span" inherit truncate miw={0}>
                {text}
            </Text>
            <ArrowSquareOutIcon size={IconSize.TINY} />
        </Anchor>
    );
}

/**
 * Groups `ItemRow`s into a single dense, hoverable table. Loading/empty/error
 * states should be rendered outside of this.
 */
export function ItemTable(props: PropsWithChildren): ReactNode {
    return (
        <Table
            highlightOnHover
            verticalSpacing="xs"
            layout="fixed"
            style={{
                cursor: "pointer"
            }}
        >
            <Table.Tbody>{props.children}</Table.Tbody>
        </Table>
    );
}

interface ItemRowProps {
    /** Left content, e.g. a `CardTitle`. */
    left: ReactNode;
    /** Menu items shown on right-click and (when shown) via the "more" button. */
    menuItems: ReactNode;
    onClick?: () => void;
    /** Extra right-aligned controls (e.g. a favorite button or an arrow). */
    rightSection?: ReactNode;
    /**
     * Show the explicit "..." button that opens the same menu.
     * @default true
     */
    moreButton?: boolean;
}

/**
 * A clickable table row with a hover state and a right-click context menu.
 * Used for documents, insertables, and favorites. Render inside an `ItemTable`.
 */
export function ItemRow(props: ItemRowProps): ReactNode {
    const { left, menuItems, onClick, rightSection, moreButton = true } = props;

    return (
        <AppContextMenu menuItems={menuItems}>
            <Table.Tr onClick={onClick}>
                <Table.Td>
                    <Group wrap="nowrap">
                        {left}
                        <Group gap="4px" justify="flex-end">
                            {moreButton && <MenuButton>{menuItems}</MenuButton>}
                            {rightSection}
                        </Group>
                    </Group>
                </Table.Td>
            </Table.Tr>
        </AppContextMenu>
    );
}

/**
 * Wraps one or more admin-only menu items into an Admin submenu.
 */
export function AdminOptionsSubmenu(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <Menu.Divider />
            <Menu.Sub>
                <Menu.Sub.Target>
                    <Menu.Sub.Item
                        color={StatusColor.WARNING}
                        leftSection={<GearIcon size={IconSize.SMALL} />}
                    >
                        Admin options
                    </Menu.Sub.Item>
                </Menu.Sub.Target>
                <Menu.Sub.Dropdown>{props.children}</Menu.Sub.Dropdown>
            </Menu.Sub>
        </RequireAccessLevel>
    );
}
