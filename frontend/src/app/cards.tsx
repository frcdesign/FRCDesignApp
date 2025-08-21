import {
    Icon,
    Card,
    EntityTitle,
    Classes,
    Text,
    Alert,
    Intent,
    Menu,
    MenuItem,
    ContextMenu,
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
import { CardThumbnail } from "./thumbnail";
import { FavoriteButton } from "./favorite";
import { useMutation } from "@tanstack/react-query";
import { useDocumentsQuery, useFavoritesQuery } from "../queries";
import {
    getSearchHitTitle,
    invalidateSearchDb,
    SearchHit
} from "../api/search";
import { apiDelete, apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { AppMenu } from "../api/menu-params";

interface DocumentCardProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card representing a single document.
 */
export function DocumentCard(props: DocumentCardProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

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
                            icon={<CardThumbnail path={document} />}
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

interface DocumentContextMenuProps {
    document: DocumentObj;
    children: any;
}

function DocumentContextMenu(props: DocumentContextMenuProps) {
    const { children, document } = props;

    const search = useSearch({ from: "/app" });
    const navigate = useNavigate();

    const setSortOrderMutation = useMutation({
        mutationKey: ["set-sort-order"],
        mutationFn: () => {
            return apiPost("/set-sort-order", {
                body: {
                    documentId: document.id,
                    sortByDefault: !document.sortByDefault
                }
            });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["documents"] });
        }
    });

    const deleteDocumentMutation = useMutation({
        mutationKey: ["delete-document"],
        mutationFn: () => {
            return apiDelete("/document", { documentId: document.id });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["documents"] });
            queryClient.refetchQueries({ queryKey: ["document-order"] });
            queryClient.refetchQueries({ queryKey: ["elements"] });
        }
    });

    const menu = (
        <Menu>
            <MenuItem
                onClick={() => {
                    setSortOrderMutation.mutate();
                }}
                icon={document.sortByDefault ? "list" : "sort-alphabetical"}
                text={document.sortByDefault ? "Use tab order" : "Sort A-Z"}
            />
            <MenuItem
                icon="add"
                text="Add document"
                labelElement={<Icon icon="share" />}
                onClick={() => {
                    navigate({
                        to: ".",
                        search: {
                            activeMenu: AppMenu.ADD_DOCUMENT_MENU,
                            selectedDocumentId: document.id
                        }
                    });
                }}
            />
            <MenuItem
                icon="delete"
                text="Delete"
                intent="danger"
                onClick={() => {
                    deleteDocumentMutation.mutate();
                }}
            />
        </Menu>
    );

    return (
        <ContextMenu
            content={menu}
            disabled={!hasMemberAccess(search.accessLevel)}
        >
            {children}
        </ContextMenu>
    );
}

interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
    searchHit?: SearchHit;
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

interface ElementContextMenuProps {
    element: ElementObj;
    children: any;
}

function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, element } = props;

    const search = useSearch({ from: "/app" });

    const mutation = useMutation({
        mutationKey: ["set-visibility"],
        mutationFn: () => {
            return apiPost("/set-visibility", {
                body: {
                    elementId: element.id,
                    isVisible: !element.isVisible
                }
            });
        },
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ["elements"] });
            invalidateSearchDb();
        }
    });

    const menu = (
        <Menu>
            <MenuItem
                onClick={() => {
                    mutation.mutate();
                }}
                intent={element.isVisible ? "danger" : "primary"}
                icon={element.isVisible ? "eye-off" : "eye-open"}
                text={element.isVisible ? "Hide element" : "Show element"}
            />
        </Menu>
    );

    return (
        <ContextMenu
            content={menu}
            disabled={!hasMemberAccess(search.accessLevel)}
        >
            {children}
        </ContextMenu>
    );
}
