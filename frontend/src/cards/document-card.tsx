import {
    Icon,
    Card,
    Classes,
    ContextMenuChildrenProps,
    ContextMenu,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentObj, LibraryObj } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { apiPost, apiDelete, useCacheOptions } from "../api/api";
import { showErrorToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { ChangeOrderItems } from "./change-order";
import {
    useSetVisibilityMutation
} from "./card-hooks";
import { AdminSubmenu, CardTitle, OpenDocumentItems, ReloadThumbnailMenuItem } from "./card-components";
import { AddDocumentItem } from "../app/add-document-menu";
import {
    libraryQueryKey,
    libraryQueryMatchKey,
    useLibraryQuery
} from "../queries";
import { toLibraryPath, useLibrary } from "../api/library";
import { getQueryUpdater, useIsHome } from "../common/utils";
import { getAppErrorHandler } from "../api/errors";

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
                        <CardTitle
                            title={document.name}
                            thumbnailUrls={document.thumbnailUrls}
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

export function DocumentContextMenu(props: DocumentContextMenuProps) {
    const { children, document } = props;

    const isHome = useIsHome();
    const library = useLibrary();

    const deleteDocumentMutation = useMutation({
        mutationKey: ["delete-document"],
        mutationFn: async () => {
            return apiDelete("/document" + toLibraryPath(library), {
                query: { documentId: document.id }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
        }
    });

    const setDocumentOrderMutation = useSetDocumentOrderMutation();
    const documentOrder = useLibraryQuery().data?.documentOrder ?? [];

    const showAllMutation = useSetVisibilityMutation(
        document.id,
        document.elementOrder,
        true
    );

    const hideAllMutation = useSetVisibilityMutation(
        document.id,
        document.elementOrder,
        false
    );

    const orderItems = isHome && (
        <>
            <ChangeOrderItems
                id={document.id}
                order={documentOrder}
                onOrderChange={(newOrder) =>
                    setDocumentOrderMutation.mutate(newOrder)
                }
            />
            {/* Only show second divider when we have more than one document since otherwise there's no reorder items */}
            {documentOrder.length > 1 && <MenuDivider />}
        </>
    );

    const modifyDocumentItems = isHome && (
        <>
            <MenuDivider />
            <MenuItem
                icon="trash"
                text="Delete"
                intent="danger"
                onClick={() => {
                    deleteDocumentMutation.mutate();
                }}
            />
            <AddDocumentItem />
        </>
    );

    const menu = (
        <Menu>
            <OpenDocumentItems path={document.path} />
            <AdminSubmenu>
                {orderItems}
                <MenuItem
                    icon="eye-open"
                    text="Show all elements"
                    onClick={() => {
                        showAllMutation.mutate();
                    }}
                />
                <MenuItem
                    icon="eye-off"
                    text="Hide all elements"
                    onClick={() => {
                        hideAllMutation.mutate();
                    }}
                />
                <DocumentDataItems document={document} />
                <ReloadThumbnailMenuItem path={document.path} />
                {modifyDocumentItems}
            </AdminSubmenu>
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
}

function useSetDocumentOrderMutation() {
    const library = useLibrary();
    const cacheOptions = useCacheOptions();
    return useMutation({
        mutationKey: ["document-order"],
        mutationFn: async (documentOrder: string[]) => {
            return apiPost("/document-order" + toLibraryPath(library), {
                body: { documentOrder }
            });
        },
        onMutate: (newOrder: string[]) => {
            queryClient.setQueryData(
                libraryQueryKey(library, cacheOptions),
                getQueryUpdater((data: LibraryObj) => {
                    data.documentOrder = newOrder;
                    return data;
                })
            );
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder document.");
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
        }
        // Don't need an onSettled handler since document-order doesn't expire
    });
}

function useToggleSortOrderMutation(document: DocumentObj) {
    const library = useLibrary();
    const cacheOptions = useCacheOptions();

    return useMutation({
        mutationKey: ["sort-document-alphabetically"],
        mutationFn: async () => {
            return apiPost(
                "/sort-document-alphabetically" + toLibraryPath(library),
                {
                    body: {
                        documentId: document.id,
                        sortAlphabetically: !document.sortAlphabetically
                    }
                }
            );
        },
        onMutate: () => {
            queryClient.setQueryData(
                libraryQueryKey(library, cacheOptions),
                getQueryUpdater((data: LibraryObj) => {
                    const oldDocument = data.documents[document.id];
                    if (oldDocument) {
                        oldDocument.sortAlphabetically =
                            !document.sortAlphabetically;
                    }
                    return data;
                })
            );
        },
        onError: getAppErrorHandler(
            `Failed to update document ${document.name}.`
        ),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
        }
    });
}

interface DocumentDataItemsProps {
    document: DocumentObj;
}

function DocumentDataItems({ document }: DocumentDataItemsProps) {
    const toggleSortOrderMutation = useToggleSortOrderMutation(document);
    return (
        <>
            <MenuItem
                onClick={() => {
                    toggleSortOrderMutation.mutate();
                }}
                icon={
                    document.sortAlphabetically ? "list" : "sort-alphabetical"
                }
                text={
                    document.sortAlphabetically
                        ? "Use tab order"
                        : "Sort alphabetically"
                }
            />
        </>
    );
}
