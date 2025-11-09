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
import { useMatch, useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentObj, LibraryObj } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { RequireAccessLevel } from "../api/access-level";
import { apiPost, apiDelete, useCacheOptions } from "../api/api";
import { showErrorToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { ChangeOrderItems } from "./change-order";
import { useSetVisibilityMutation } from "./card-hooks";
import { CardTitle, OpenDocumentItems } from "./card-components";
import { AddDocumentItem } from "../app/add-document-menu";
import {
    libraryQueryKey,
    libraryQueryMatchKey,
    useLibraryQuery
} from "../queries";
import { toLibraryPath, useLibrary } from "../api/library";
import { getQueryUpdater } from "../common/utils";

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

    const isHome =
        useMatch({ from: "/app/documents/", shouldThrow: false }) !== undefined;
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
            <MenuDivider />
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
            <OpenDocumentItems path={document} />
            <RequireAccessLevel>
                <MenuDivider />
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
                <ToggleDocumentSortItem document={document} />
                {modifyDocumentItems}
            </RequireAccessLevel>
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
}

function useSetDocumentOrderMutation() {
    const library = useLibrary();
    const cacheOptions = useCacheOptions();
    return useMutation({
        mutationKey: ["set-document-order"],
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

function useToggleDocumentSortMutation(document: DocumentObj) {
    const library = useLibrary();
    return useMutation({
        mutationKey: ["set-document-sort"],
        mutationFn: async () => {
            return apiPost("/set-document-sort" + toLibraryPath(library), {
                body: {
                    documentId: document.id,
                    sortAlphabetically: !document.sortAlphabetically
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
        }
    });
}

interface ToggleDocumentSortItemProps {
    document: DocumentObj;
}

function ToggleDocumentSortItem({ document }: ToggleDocumentSortItemProps) {
    const toggleDocumentSortMutation = useToggleDocumentSortMutation(document);
    return (
        <MenuItem
            onClick={() => {
                toggleDocumentSortMutation.mutate();
            }}
            icon={document.sortAlphabetically ? "list" : "sort-alphabetical"}
            text={
                document.sortAlphabetically
                    ? "Use tab order"
                    : "Sort alphabetically"
            }
        />
    );
}
