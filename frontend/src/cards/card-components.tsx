import {
    Alert,
    Button,
    ButtonVariant,
    Classes,
    EntityTitle,
    MenuItem,
    Tag,
    Text
} from "@blueprintjs/core";
import { copyUrlToClipboard, makeUrl, openUrlInNewTab } from "../common/url";
import { MouseEventHandler, ReactNode } from "react";
import { SearchHit } from "../search/search";
import { SearchHitTitle } from "../search/search-results";
import { CardThumbnail } from "../favorites/thumbnail";
import { DocumentPath, ElementPath } from "../api/path";
import { AppAlertProps } from "../common/utils";

interface OpenDocumentItemsProps {
    path: DocumentPath;
}

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

/**
 * A controlled alert warning that assemblies cannot be derived into part studios.
 */
export function CannotDeriveAssemblyAlert(props: AppAlertProps): ReactNode {
    const { onClose, isOpen } = props;
    if (!isOpen) {
        return null;
    }
    return (
        <Alert
            isOpen
            canEscapeKeyCancel
            canOutsideClickCancel
            onClose={onClose}
            confirmButtonText="Close"
            icon="cross"
            intent="danger"
        >
            This part is an assembly and cannot be derived into a part studio.
        </Alert>
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
    title: string;
    searchHit?: SearchHit;
    elementPath: ElementPath;
}

export function CardTitle(props: CardTitleProps) {
    const { searchHit, title, elementPath } = props;
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
        cardTitle = <SearchHitTitle searchHit={searchHit} />;
    } else {
        cardTitle = <Text>{title}</Text>;
    }

    return (
        <EntityTitle
            className={disabled ? Classes.TEXT_MUTED : undefined}
            ellipsize
            title={cardTitle}
            icon={<CardThumbnail path={elementPath} />}
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
