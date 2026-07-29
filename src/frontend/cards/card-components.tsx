import { ActionIcon, Group, Menu, Table, Text } from "@mantine/core";
import {
    IconDots,
    IconExternalLink,
    IconEyeOff,
    IconLink,
    IconPlus,
    IconRefresh,
    IconSettings
} from "@tabler/icons-react";
import { IconColor, IconSize } from "../common/style-constants";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../common/url";
import { PropsWithChildren, ReactNode, useCallback } from "react";
import { AppContextMenu } from "../app-common/app-menu";
import { SearchHit } from "../search/search";
import { SearchHitTitle } from "../search/search-results";
import { CardThumbnail } from "../insert/thumbnail";
import { DocumentPath } from "../../shared/onshape-path";
import { openCannotDeriveAssemblyAlert } from "../app/alerts";
import {
    useInsertMutation,
    useIsAssemblyInPartStudio
} from "../insert/insert-hooks";
import { InsertableOut } from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import { ThumbnailUrls } from "../../shared/types";
import { ParameterValues } from "../../shared/configuration-models";
import { useSearch } from "@tanstack/react-router";
import { RequireAccessLevel } from "../api-utils/access-level";
import { useReloadThumbnailMutation } from "./card-hooks";

interface OpenDocumentItemsProps {
    path: DocumentPath;
}

/**
 * Menu items which can be used to open or copy a link to a document.
 */
export function OpenDocumentItems(props: OpenDocumentItemsProps) {
    const url = makeUrl(props.path);
    return (
        <>
            <Menu.Item
                leftSection={<IconExternalLink size={IconSize.SMALL} />}
                onClick={() => openUrlInNewTab(url)}
            >
                Open document
            </Menu.Item>
            <Menu.Item
                leftSection={<IconLink size={IconSize.SMALL} />}
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
                    leftSection={<IconPlus size={IconSize.SMALL} />}
                    onClick={() => handleClick(true)}
                >
                    Quick insert and fasten
                </Menu.Item>
            )}
            <Menu.Item
                leftSection={<IconPlus size={IconSize.SMALL} />}
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
    thumbnailUrls: ThumbnailUrls;
    /** Optional build-status badge rendered after the title. */
    buildStatusBadge?: ReactNode;
}

export function CardTitle(props: CardTitleProps) {
    const { searchHit, title, thumbnailUrls, buildStatusBadge } = props;
    const disabled = props.disabled ?? false;
    const isHidden = props.showHiddenTag ?? false;

    let cardTitle: ReactNode;
    if (searchHit) {
        cardTitle = <SearchHitTitle title={title} searchHit={searchHit} />;
    } else {
        cardTitle = title;
    }

    return (
        <Group gap="sm" wrap="nowrap" flex={1} miw={0}>
            <CardThumbnail thumbnailUrls={thumbnailUrls} />
            <Text size="sm" truncate c={disabled ? "dimmed" : undefined}>
                {cardTitle}
            </Text>
            {isHidden && (
                <IconEyeOff
                    size={IconSize.SMALL}
                    color={IconColor.YELLOW}
                    title="Hidden"
                />
            )}
            {buildStatusBadge}
        </Group>
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
 * An explicit button which opens a menu with the given items. Used alongside
 * the right-click context menu so the menu is reachable without a right-click.
 */
export function MenuButton(props: PropsWithChildren): ReactNode {
    return (
        <AppContextMenu controlledByButton menuItems={props.children}>
            <ActionIcon
                variant="subtle"
                color="gray"
                title="View options"
                onClick={(e) => e.stopPropagation()}
            >
                <IconDots size={IconSize.MEDIUM} />
            </ActionIcon>
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
                        color="yellow"
                        leftSection={<IconSettings size={IconSize.SMALL} />}
                    >
                        Admin options
                    </Menu.Sub.Item>
                </Menu.Sub.Target>
                <Menu.Sub.Dropdown>{props.children}</Menu.Sub.Dropdown>
            </Menu.Sub>
        </RequireAccessLevel>
    );
}

interface ReloadThumbnailMenuItemProps {
    id: string;
    isGroup: boolean;
}

export function ReloadThumbnailMenuItem(
    props: ReloadThumbnailMenuItemProps
): ReactNode {
    const reloadThumbnailMutation = useReloadThumbnailMutation(
        props.id,
        props.isGroup
    );
    return (
        <Menu.Item
            leftSection={<IconRefresh size={IconSize.SMALL} />}
            onClick={() => {
                reloadThumbnailMutation.mutate();
            }}
        >
            Reload thumbnail
        </Menu.Item>
    );
}
