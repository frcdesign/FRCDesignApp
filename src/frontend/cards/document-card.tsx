import { Menu } from "@mantine/core";
import {
    IconArrowRight,
    IconEye,
    IconEyeOff,
    IconList,
    IconSortAZ,
    IconTrash
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentOut, LibraryOut } from "../../shared/api-models";
import { useMutation } from "@tanstack/react-query";
import { apiPost, apiDelete, useCacheOptions } from "../api-utils/api";
import { showErrorToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { ChangeOrderItems } from "./change-order";
import { useSetVisibilityMutation } from "./card-hooks";
import {
    AdminSubmenu,
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    ReloadThumbnailMenuItem
} from "./card-components";
import { AddDocumentItem } from "../app/add-document-menu";
import {
    libraryQueryKey,
    libraryQueryMatchKey,
    useLibraryQuery
} from "../queries";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { getQueryUpdater, useIsHome } from "../common/utils";
import { getAppErrorHandler } from "../api-utils/errors";

interface DocumentCardProps extends PropsWithChildren {
    document: DocumentOut;
}

/**
 * A card representing a single document.
 */
export function DocumentCard(props: DocumentCardProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

    return (
        <ItemRow
            onClick={() => {
                void navigate({
                    to: "/app/documents/$documentId",
                    params: { documentId: document.id }
                });
            }}
            left={
                <CardTitle
                    title={document.name}
                    thumbnailUrls={document.thumbnailUrls}
                />
            }
            rightSection={
                <IconArrowRight size={16} color="var(--mantine-color-dimmed)" />
            }
            moreButton={false}
            menu={<DocumentMenuItems document={document} />}
        />
    );
}

interface DocumentMenuItemsProps {
    document: DocumentOut;
}

export function DocumentMenuItems(props: DocumentMenuItemsProps): ReactNode {
    const { document } = props;

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
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
    });

    const setDocumentOrderMutation = useSetDocumentOrderMutation();
    const documentOrder = useLibraryQuery().data?.documentOrder ?? [];

    const showAllMutation = useSetVisibilityMutation(
        document.insertableOrder,
        true
    );

    const hideAllMutation = useSetVisibilityMutation(
        document.insertableOrder,
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
            {documentOrder.length > 1 && <Menu.Divider />}
        </>
    );

    const modifyDocumentItems = isHome && (
        <>
            <Menu.Divider />
            <Menu.Item
                leftSection={<IconTrash size={16} />}
                color="red"
                onClick={() => {
                    deleteDocumentMutation.mutate();
                }}
            >
                Delete
            </Menu.Item>
            <AddDocumentItem />
        </>
    );

    return (
        <>
            <OpenDocumentItems path={document.path} />
            <AdminSubmenu>
                {orderItems}
                <Menu.Item
                    color="blue"
                    leftSection={<IconEye size={16} />}
                    onClick={() => {
                        showAllMutation.mutate();
                    }}
                >
                    Show all elements
                </Menu.Item>
                <Menu.Item
                    color="red"
                    leftSection={<IconEyeOff size={16} />}
                    onClick={() => {
                        hideAllMutation.mutate();
                    }}
                >
                    Hide all elements
                </Menu.Item>
                <DocumentDataItems document={document} />
                <ReloadThumbnailMenuItem id={document.id} isDocumentId={true} />
                {modifyDocumentItems}
            </AdminSubmenu>
        </>
    );
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
                getQueryUpdater((data: LibraryOut) => {
                    data.documentOrder = newOrder;
                    return data;
                })
            );
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to reorder document.");
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
        // Don't need an onSettled handler since document-order doesn't expire
    });
}

function useToggleSortOrderMutation(document: DocumentOut) {
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
                getQueryUpdater((data: LibraryOut) => {
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
            void queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
        }
    });
}

interface DocumentDataItemsProps {
    document: DocumentOut;
}

function DocumentDataItems({ document }: DocumentDataItemsProps) {
    const toggleSortOrderMutation = useToggleSortOrderMutation(document);
    return (
        <Menu.Item
            leftSection={
                document.sortAlphabetically ? (
                    <IconList size={16} />
                ) : (
                    <IconSortAZ size={16} />
                )
            }
            onClick={() => {
                toggleSortOrderMutation.mutate();
            }}
        >
            {document.sortAlphabetically
                ? "Use tab order"
                : "Sort alphabetically"}
        </Menu.Item>
    );
}
