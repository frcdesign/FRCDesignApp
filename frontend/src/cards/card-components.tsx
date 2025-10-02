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
import { makeUrl, openUrlInNewTab } from "../common/url";
import { MouseEventHandler, ReactNode } from "react";
import { SearchHit } from "../app/search";
import { SearchHitTitle } from "../app/search-results";
import { CardThumbnail } from "../app/thumbnail";
import { DocumentPath, ElementPath } from "../api/path";

interface OpenDocumentItemProps {
    path: DocumentPath;
}

export function OpenDocumentItem(props: OpenDocumentItemProps) {
    return (
        <MenuItem
            text="Open document"
            icon="share"
            onClick={() => openUrlInNewTab(makeUrl(props.path))}
            intent="primary"
        />
    );
}

interface CannotDeriveAssemblyAlertProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * A controlled alert warning that assemblies cannot be derived into part studios.
 */
export function CannotDeriveAssemblyAlert(
    props: CannotDeriveAssemblyAlertProps
): ReactNode {
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
