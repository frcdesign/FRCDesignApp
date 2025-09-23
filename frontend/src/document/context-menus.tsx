import {
    Menu,
    MenuItem,
    MenuDivider,
    Icon,
    ContextMenu
} from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useMatch } from "@tanstack/react-router";
import { apiPost, apiDelete } from "../api/api";
import { DocumentObj, ElementObj } from "../api/models";
import { AppMenu } from "../api/menu-params";
import { queryClient } from "../query-client";
import { ChangeDocumentOrderItems } from "./change-document-order";
import { makeUrl, openUrlInNewTab } from "../common/url";
import { invalidateSearchDb } from "../api/search";
import { RequireAccessLevel } from "../api/access-level";

interface ElementContextMenuProps {
    element: ElementObj;
    children: any;
}

export function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, element } = props;

    const mutation = useSetVisibilityMutation(
        "set-visibility",
        [element.id],
        !element.isVisible
    );

    const menu = (
        <Menu>
            <OpenDocumentItem url={makeUrl(element)} />
            <RequireAccessLevel>
                <MenuDivider />
                <MenuItem
                    onClick={() => {
                        mutation.mutate();
                    }}
                    intent={element.isVisible ? "danger" : "primary"}
                    icon={element.isVisible ? "eye-off" : "eye-open"}
                    text={element.isVisible ? "Hide element" : "Show element"}
                />
            </RequireAccessLevel>
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
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
            invalidateSearchDb();
        }
    });

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

    const orderItems = isHome && (
        <>
            <ChangeDocumentOrderItems documentId={document.id} />
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
            <OpenDocumentItem url={makeUrl(document)} />
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

interface OpenDocumentItemProps {
    url: string;
}

function OpenDocumentItem(props: OpenDocumentItemProps) {
    return (
        <MenuItem
            text="Open document"
            icon="share"
            onClick={() => openUrlInNewTab(props.url)}
            intent="primary"
        />
    );
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
            invalidateSearchDb();
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

function useSetVisibilityMutation(
    mutationKey: string,
    elementIds: string[],
    isVisible: boolean
) {
    return useMutation({
        mutationKey: [mutationKey],
        mutationFn: async () => {
            return apiPost("/set-visibility", {
                body: {
                    elementIds,
                    isVisible
                }
            });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["elements"] });
            invalidateSearchDb();
        }
    });
}
