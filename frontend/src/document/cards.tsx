import {
    Icon,
    Card,
    EntityTitle,
    Classes,
    Text,
    Alert,
    Intent,
    ContextMenuChildrenProps,
    Tag
} from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import {
    AccessLevel,
    DocumentObj,
    ElementObj,
    ElementType,
    hasMemberAccess
} from "../api/backend-types";
import { CardThumbnail } from "../app/thumbnail";
import { FavoriteButton } from "../app/favorite";
import { useDocumentsQuery, useFavoritesQuery } from "../queries";
import { getSearchHitTitle, SearchHit } from "../api/search";
import { AppMenu } from "../api/menu-params";
import { DocumentContextMenu, ElementContextMenu } from "./context-menus";

interface DocumentCardProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card representing a single document.
 */
export function DocumentCard(props: DocumentCardProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

    const thumbnailPath = {
        documentId: document.documentId,
        instanceId: document.instanceId,
        instanceType: document.instanceType,
        elementId: document.thumbnailElementId
    };

    return (
        <DocumentContextMenu document={document}>
            {(ctxMenuProps: ContextMenuChildrenProps) => (
                <>
                    <Card
                        onContextMenu={ctxMenuProps.onContextMenu}
                        ref={ctxMenuProps.ref}
                        interactive
                        onClick={() => {
                            navigate({
                                to: "/app/documents/$documentId",
                                params: { documentId: document.id }
                            });
                        }}
                        className="item-card"
                    >
                        <EntityTitle
                            title={<Text>{document.name}</Text>}
                            icon={<CardThumbnail path={thumbnailPath} />}
                        />
                        <Icon
                            icon="arrow-right"
                            className={Classes.TEXT_MUTED}
                        />
                    </Card>
                    {ctxMenuProps.popover}
                </>
            )}
        </DocumentContextMenu>
    );
}

interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
    searchHit?: SearchHit;
    onClick?: () => void;
}

/**
 * A card representing a part studio or assembly.
 */
export function ElementCard(props: ElementCardProps): ReactNode {
    const { element, searchHit } = props;
    const navigate = useNavigate();
    const search = useSearch({ from: "/app" });
    const data = useDocumentsQuery().data;
    const favorites = useFavoritesQuery(search).data;

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    if (
        !data ||
        !favorites ||
        (search.accessLevel === AccessLevel.USER && !element.isVisible)
    ) {
        return null;
    }

    const isAssemblyInPartStudio =
        element.elementType === ElementType.ASSEMBLY &&
        search.elementType == ElementType.PART_STUDIO;

    const isFavorite = favorites[element.elementId] !== undefined;

    const alert = isAlertOpen ? (
        <CannotDeriveAssemblyAlert onClose={() => setIsAlertOpen(false)} />
    ) : null;

    let title;
    if (searchHit) {
        title = getSearchHitTitle(searchHit);
    } else {
        title = element.name;
    }

    let hiddenTag = null;
    if (hasMemberAccess(search.accessLevel) && !element.isVisible) {
        hiddenTag = (
            <Tag round intent="warning" icon="eye-off" title="Hidden" />
        );
    }

    return (
        <ElementContextMenu element={element}>
            {(ctxMenuProps: ContextMenuChildrenProps) => (
                <>
                    <Card
                        className="item-card"
                        onContextMenu={ctxMenuProps.onContextMenu}
                        ref={ctxMenuProps.ref}
                        interactive
                        onClick={() => {
                            if (props.onClick) {
                                props.onClick();
                            }

                            if (isAssemblyInPartStudio) {
                                setIsAlertOpen(true);
                                return;
                            }

                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: AppMenu.INSERT_MENU,
                                    activeElementId: element.elementId
                                }
                            });
                        }}
                    >
                        <EntityTitle
                            className={
                                isAssemblyInPartStudio
                                    ? Classes.TEXT_MUTED
                                    : undefined
                            }
                            ellipsize
                            title={title}
                            icon={<CardThumbnail path={element} />}
                            tags={hiddenTag}
                        />
                        <FavoriteButton
                            isFavorite={isFavorite}
                            element={element}
                        />
                    </Card>
                    {ctxMenuProps.popover}
                    {alert}
                </>
            )}
        </ElementContextMenu>
    );
}

interface CannotDeriveAssemblyAlertProps {
    onClose: () => void;
}

function CannotDeriveAssemblyAlert(props: CannotDeriveAssemblyAlertProps) {
    const { onClose } = props;
    return (
        <Alert
            isOpen
            canEscapeKeyCancel
            canOutsideClickCancel
            onClose={onClose}
            confirmButtonText="Close"
            icon="cross"
            intent={Intent.DANGER}
        >
            This part is an assembly and cannot be derived into a part studio.
        </Alert>
    );
}
