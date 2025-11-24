import {
    Button,
    ButtonVariant,
    Classes,
    EntityTitle,
    MenuDivider,
    MenuItem,
    Tag
} from "@blueprintjs/core";
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
import { DocumentPath, ElementPath, InstancePath } from "../api/path";
import { AppPopup, useOpenAlert } from "../overlays/popup-params";
import {
    useInsertMutation,
    useIsAssemblyInPartStudio
} from "../insert/insert-hooks";
import { ElementObj, ElementType, ThumbnailUrls } from "../api/models";
import { Configuration } from "../insert/configuration-models";
import { useSearch } from "@tanstack/react-router";
import { RequireAccessLevel } from "../api/access-level";
import { useReloadThumbnailMutation } from "./card-hooks";

interface OpenDocumentItemsProps {
    path: DocumentPath;
}

/**
 * MenuItems which can be used to open or copy a link to a document.
 */
export function OpenDocumentItems(props: OpenDocumentItemsProps) {
    const url = makeUrl(props.path);
    return (
        <>
            <MenuItem
                text="Open document"
                icon="share"
                onClick={() => openUrlInNewTab(url)}
            />
            <MenuItem
                text="Copy link"
                icon="link"
                onClick={() => copyUrlToClipboard(url)}
            />
        </>
    );
}

interface QuickInsertItemProps {
    element: ElementObj;
    configuration?: Configuration;
    isFavorite: boolean;
}

/**
 * MenuItems which can be used to quick insert a document.
 */
export function QuickInsertItems(props: QuickInsertItemProps) {
    const { element, configuration, isFavorite } = props;
    const search = useSearch({ from: "/app" });

    const insertMutation = useInsertMutation(element, configuration, {
        isFavorite,
        isQuickInsert: true
    });
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );
    const openAlert = useOpenAlert();

    const handleClick = useCallback(
        (fasten: boolean) => {
            if (isAssemblyInPartStudio) {
                openAlert(AppPopup.CANNOT_DERIVE_ASSEMBLY);
                return;
            }
            insertMutation.mutate(fasten);
        },
        [isAssemblyInPartStudio, insertMutation, openAlert]
    );

    const supportsFasten =
        element.supportsFasten && search.elementType === ElementType.ASSEMBLY;

    return (
        <>
            {supportsFasten && (
                <MenuItem
                    text="Quick insert and fasten"
                    icon="add"
                    onClick={() => handleClick(true)}
                />
            )}
            <MenuItem
                text="Quick insert"
                icon="add"
                onClick={() => handleClick(false)}
            />
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

    let hiddenTag = null;
    if (isHidden) {
        hiddenTag = (
            <Tag round intent="warning" icon="eye-off" title="Hidden" />
        );
    }

    let cardTitle;
    if (searchHit) {
        cardTitle = <SearchHitTitle title={title} searchHit={searchHit} />;
    } else {
        cardTitle = title;
    }

    return (
        <EntityTitle
            className={disabled ? Classes.TEXT_MUTED : undefined}
            ellipsize
            title={cardTitle}
            icon={<CardThumbnail thumbnailUrls={thumbnailUrls} />}
            tags={hiddenTag}
        />
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
        <>
            <Button
                icon="more"
                onClick={(event) => {
                    event.stopPropagation();
                    props.onClick(event);
                }}
                title="View options"
                variant={ButtonVariant.MINIMAL}
            />
        </>
    );
}

/**
 * Wraps one or more admin-only menu items into an Admin submenu.
 */
export function AdminSubmenu(props: PropsWithChildren): ReactNode {
    return (
        <RequireAccessLevel>
            <MenuDivider />
            <MenuItem
                text="Admin options"
                icon="cog"
                intent="primary"
                children={props.children}
            />
        </RequireAccessLevel>
    );
}

interface ReloadThumbnailMenuItemProps {
    path: InstancePath | ElementPath;
}

export function ReloadThumbnailMenuItem(
    props: ReloadThumbnailMenuItemProps
): ReactNode {
    const reloadThumbnailMutation = useReloadThumbnailMutation(props.path);
    return (
        <MenuItem
            onClick={() => {
                reloadThumbnailMutation.mutate();
            }}
            icon="refresh"
            text="Reload thumbnail"
        />
    );
}
