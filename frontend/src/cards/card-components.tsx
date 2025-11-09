import {
    Button,
    ButtonVariant,
    Classes,
    EntityTitle,
    MenuItem,
    Tag
} from "@blueprintjs/core";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../common/url";
import { MouseEventHandler, ReactNode, useCallback } from "react";
import { SearchHit } from "../search/search";
import { SearchHitTitle } from "../search/search-results";
import { CardThumbnail } from "../insert/thumbnail";
import { DocumentPath } from "../api/path";
import { AlertType, useOpenAlert } from "../search-params/alert-type";
import {
    useInsertMutation,
    useIsAssemblyInPartStudio
} from "../insert/insert-hooks";
import { ElementObj, ThumbnailUrls } from "../api/models";
import { Configuration } from "../insert/configuration-models";

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
    defaultConfiguration?: Configuration;
    isFavorite: boolean;
}

/**
 * MenuItems which can be used to quick insert a document.
 */
export function QuickInsertItem(props: QuickInsertItemProps) {
    const { element, defaultConfiguration, isFavorite } = props;
    const insertMutation = useInsertMutation(
        element,
        defaultConfiguration,
        isFavorite,
        true
    );
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );
    const openAlert = useOpenAlert();

    const handleClick = useCallback(() => {
        if (isAssemblyInPartStudio) {
            openAlert(AlertType.CANNOT_DERIVE_ASSEMBLY);
            return;
        }
        insertMutation.mutate();
    }, [isAssemblyInPartStudio, insertMutation, openAlert]);

    return <MenuItem text="Quick insert" icon="add" onClick={handleClick} />;
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
