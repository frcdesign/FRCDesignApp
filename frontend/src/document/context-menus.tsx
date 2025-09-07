import {
    Menu,
    MenuItem,
    MenuDivider,
    Icon,
    ContextMenu
} from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { useSearch, useNavigate, useMatch } from "@tanstack/react-router";
import { apiPost, apiDelete } from "../api/api";
import { DocumentObj, ElementObj, hasMemberAccess } from "../api/backend-types";
import { AppMenu } from "../api/menu-params";
import { queryClient } from "../query-client";
import { ChangeDocumentOrderItems } from "./change-document-order";
import { makeUrl, openUrlInNewTab } from "../common/url";
import { invalidateSearchDb } from "../api/search";

interface ElementContextMenuProps {
    element: ElementObj;
    children: any;
}

export function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, element } = props;

    const search = useSearch({ from: "/app" });

    const mutation = useSetVisibilityMutation(
        "set-visibility",
        [element.id],
        !element.isVisible
    );

    const menu = (
        <Menu>
            <OpenItem url={makeUrl(element)} />
            <MenuDivider />
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

interface DocumentContextMenuProps {
    document: DocumentObj;
    children: any;
}

export function DocumentContextMenu(props: DocumentContextMenuProps) {
    const { children, document } = props;

    const search = useSearch({ from: "/app" });
    const navigate = useNavigate();

    const isHome =
        useMatch({ from: "/app/documents/", shouldThrow: false }) !== undefined;

    const deleteDocumentMutation = useMutation({
        mutationKey: ["delete-document"],
        mutationFn: () => {
            return apiDelete("/document", { documentId: document.id });
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
            <OpenItem url={makeUrl(document)} />
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

interface OpenItemProps {
    url: string;
}

function OpenItem(props: OpenItemProps) {
    return (
        <MenuItem
            text="Open"
            icon="share"
            onClick={() => openUrlInNewTab(props.url)}
            intent="primary"
        />
    );
}

function useToggleDocumentSortMutation(document: DocumentObj) {
    return useMutation({
        mutationKey: ["set-document-sort"],
        mutationFn: () => {
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
        mutationFn: () => {
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
