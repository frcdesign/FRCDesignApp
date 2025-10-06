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
import { DocumentObj, DocumentOrder } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { RequireAccessLevel } from "../api/access-level";
import { apiPost, apiDelete } from "../api/api";
import { AppMenu } from "../api/menu-params";
import { showErrorToast } from "../common/toaster";
import { useDocumentOrderQuery } from "../queries";
import { queryClient } from "../query-client";
import { ChangeOrderItems } from "./change-order";
import { useSetVisibilityMutation } from "./card-hooks";
import { CardTitle, OpenDocumentItems } from "./card-components";

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
                        <CardTitle
                            title={document.name}
                            elementPath={thumbnailPath}
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

    const navigate = useNavigate();

    const isHome =
        useMatch({ from: "/app/documents/", shouldThrow: false }) !== undefined;

    const deleteDocumentMutation = useMutation({
        mutationKey: ["delete-document"],
        mutationFn: async () => {
            return apiDelete("/document", {
                query: { documentId: document.id }
            });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["documents"] });
            queryClient.refetchQueries({ queryKey: ["document-order"] });
            queryClient.refetchQueries({ queryKey: ["elements"] });
        }
    });

    const setDocumentOrderMutation = useSetDocumentOrderMutation();
    const documentOrder = useDocumentOrderQuery();

    const showAllMutation = useSetVisibilityMutation(
        "show-all",
        document.elementIds,
        true
    );

    const hideAllMutation = useSetVisibilityMutation(
        "hide-all",
        document.elementIds,
        false
    );

    if (!documentOrder.data) {
        return null;
    }

    const orderItems = isHome && (
        <>
            <ChangeOrderItems
                id={document.id}
                order={documentOrder.data}
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
                icon="add"
                text="Add document"
                labelElement={<Icon icon="share" />}
                intent="primary"
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
                icon="trash"
                text="Delete"
                intent="danger"
                onClick={() => {
                    deleteDocumentMutation.mutate();
                }}
            />
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
    return useMutation({
        mutationKey: ["set-document-order"],
        mutationFn: async (documentOrder: DocumentOrder) => {
            return apiPost("/document-order", { body: { documentOrder } });
        },
        onMutate: (newOrder: DocumentOrder) => {
            queryClient.setQueryData(["document-order"], newOrder);
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder document.");
            queryClient.refetchQueries({ queryKey: ["document-order"] });
        }
    });
}

function useToggleDocumentSortMutation(document: DocumentObj) {
    return useMutation({
        mutationKey: ["set-document-sort"],
        mutationFn: async () => {
            return apiPost("/set-document-sort", {
                body: {
                    documentId: document.id,
                    sortAlphabetically: !document.sortAlphabetically
                }
            });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["documents"] });
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
