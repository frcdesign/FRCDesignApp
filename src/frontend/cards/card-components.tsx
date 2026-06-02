import { ActionIcon, Badge, Group, Text } from "@mantine/core";
import {
    IconDots,
    IconEyeOff,
    IconLink,
    IconPlus,
    IconRefresh,
    IconSettings,
    IconShare
} from "@tabler/icons-react";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../common/url";
import {
    MouseEventHandler,
    PropsWithChildren,
    ReactNode,
    useCallback
} from "react";
import { SearchHit } from "../search/search";
import { SearchHitTitle } from "../search/search-results";
import { CardThumbnail } from "../insert/thumbnail";
import { DocumentPath } from "../../shared/path";
import { openCannotDeriveAssemblyAlert } from "../overlays/alerts";
import {
    useInsertMutation,
    useIsAssemblyInPartStudio
} from "../insert/insert-hooks";
import { InsertableOut } from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import { ThumbnailUrls } from "../../shared/types";
import { Configuration } from "../../shared/configuration-models";
import { useSearch } from "@tanstack/react-router";
import { RequireAccessLevel } from "../api-utils/access-level";
import { useReloadThumbnailMutation } from "./card-hooks";
import { AppMenuItem, AppMenuDivider, AppSubmenu } from "../common/app-menu";

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
            <AppMenuItem
                icon={<IconShare size={16} />}
                onClick={() => openUrlInNewTab(url)}
            >
                Open document
            </AppMenuItem>
            <AppMenuItem
                icon={<IconLink size={16} />}
                onClick={() => {
                    void copyUrlToClipboard(url);
                }}
            >
                Copy link
            </AppMenuItem>
        </>
    );
}

interface QuickInsertItemProps {
    insertable: InsertableOut;
    configuration?: Configuration;
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
                <AppMenuItem
                    icon={<IconPlus size={16} />}
                    onClick={() => handleClick(true)}
                >
                    Quick insert and fasten
                </AppMenuItem>
            )}
            <AppMenuItem
                icon={<IconPlus size={16} />}
                onClick={() => handleClick(false)}
            >
                Quick insert
            </AppMenuItem>
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
}

export function CardTitle(props: CardTitleProps) {
    const { searchHit, title, thumbnailUrls } = props;
    const disabled = props.disabled ?? false;
    const isHidden = props.showHiddenTag ?? false;

    let cardTitle: ReactNode;
    if (searchHit) {
        cardTitle = <SearchHitTitle title={title} searchHit={searchHit} />;
    } else {
        cardTitle = title;
    }

    return (
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <CardThumbnail thumbnailUrls={thumbnailUrls} />
            <Text size="sm" truncate c={disabled ? "dimmed" : undefined}>
                {cardTitle}
            </Text>
            {isHidden && (
                <Badge
                    color="yellow"
                    variant="light"
                    circle
                    title="Hidden"
                    style={{ flexShrink: 0 }}
                >
                    <IconEyeOff size={12} style={{ display: "block" }} />
                </Badge>
            )}
        </Group>
    );
}

interface ContextMenuButtonProps {
    /**
     * Function which is invoked when clicked.
     */
    onClick: MouseEventHandler<HTMLElement>;
}

/**
 * A button which can be used to explicitly launch a context menu.
 */
export function ContextMenuButton(props: ContextMenuButtonProps): ReactNode {
    return (
        <ActionIcon
            variant="subtle"
            color="gray"
            title="View options"
            onClick={(event) => {
                event.stopPropagation();
                props.onClick(event);
            }}
        >
            <IconDots size={18} />
        </ActionIcon>
    );
}

/**
 * Wraps one or more admin-only menu items into an Admin submenu.
 */
export function AdminSubmenu(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <AppMenuDivider />
            <AppSubmenu
                title="Admin options"
                icon={
                    <IconSettings
                        size={16}
                        color="var(--mantine-color-blue-6)"
                    />
                }
            >
                {props.children}
            </AppSubmenu>
        </RequireAccessLevel>
    );
}

interface ReloadThumbnailMenuItemProps {
    id: string;
    isDocumentId: boolean;
}

export function ReloadThumbnailMenuItem(
    props: ReloadThumbnailMenuItemProps
): ReactNode {
    const reloadThumbnailMutation = useReloadThumbnailMutation(
        props.id,
        props.isDocumentId
    );
    return (
        <AppMenuItem
            icon={<IconRefresh size={16} />}
            onClick={() => {
                reloadThumbnailMutation.mutate();
            }}
        >
            Reload thumbnail
        </AppMenuItem>
    );
}
