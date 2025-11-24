import {
    ContextMenuChildrenProps,
    Card,
    ContextMenu,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { ElementObj, ElementType, LibraryObj } from "../api/models";
import { SearchHit } from "../search/search";
import {
    FavoriteButton,
    FavoriteElementItem
} from "../favorites/favorite-button";
import { useIsElementHidden, useSetVisibilityMutation } from "./card-hooks";
import {
    AdminSubmenu,
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems,
    QuickInsertItems
} from "./card-components";
import { AppPopup, useOpenAlert } from "../overlays/popup-params";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { MenuType } from "../overlays/menu-params";
import {
    libraryQueryKey,
    libraryQueryMatchKey,
    useLibraryUserDataQuery
} from "../queries";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { toElementApiPath } from "../api/path";
import { showSuccessToast } from "../common/toaster";
import { toLibraryPath, useLibrary } from "../api/library";
import { getAppErrorHandler } from "../api/errors";
import { getQueryUpdater } from "../common/utils";
import { router } from "../router";

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

    const userData = useLibraryUserDataQuery().data;

    const isHidden = useIsElementHidden(element);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );
    const openAlert = useOpenAlert();

    if (isHidden || !userData) {
        return null;
    }

    const isFavorite = userData.favorites[element.id] !== undefined;

    return (
        <ElementContextMenu isFavorite={isFavorite} element={element}>
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
                                openAlert(AppPopup.CANNOT_DERIVE_ASSEMBLY);
                                return;
                            }

                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: MenuType.INSERT_MENU,
                                    activeElementId: element.id
                                }
                            });
                        }}
                    >
                        <CardTitle
                            disabled={isAssemblyInPartStudio}
                            searchHit={searchHit}
                            title={element.name}
                            thumbnailUrls={element.thumbnailUrls}
                            showHiddenTag={!element.isVisible}
                        />
                        <div className="item-card-right-content">
                            <FavoriteButton
                                isFavorite={isFavorite}
                                element={element}
                            />
                            <ContextMenuButton
                                onClick={ctxMenuProps.onContextMenu}
                            />
                        </div>
                    </Card>
                    {ctxMenuProps.popover}
                </>
            )}
        </ElementContextMenu>
    );
}

interface ElementContextMenuProps {
    isFavorite: boolean;
    element: ElementObj;
    children: any;
}

export function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, isFavorite, element } = props;

    const menu = (
        <Menu>
            <QuickInsertItems element={element} isFavorite={isFavorite} />
            <MenuDivider />
            <FavoriteElementItem isFavorite={isFavorite} element={element} />
            <MenuDivider />
            <OpenDocumentItems path={element.path} />
            <AdminSubmenu>
                <ElementAdminContextMenu element={element} />
            </AdminSubmenu>
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
}

interface ElementAdminContextMenuProps {
    element: ElementObj;
}

export function ElementAdminContextMenu(props: ElementAdminContextMenuProps) {
    const { element } = props;

    const library = useLibrary();
    const search = useSearch({ from: "/app" });

    const setVisibilityMutation = useSetVisibilityMutation(
        element.documentId,
        [element.id],
        !element.isVisible
    );

    const setOpenCompositeMutation = useMutation({
        mutationKey: ["is-open-composite"],
        mutationFn: () => {
            return apiPost("/is-open-composite" + toLibraryPath(library), {
                body: {
                    isOpenComposite: !element.isOpenComposite,
                    documentId: element.documentId,
                    elementId: element.id
                }
            });
        },
        onMutate: () => {
            queryClient.cancelQueries({ queryKey: libraryQueryMatchKey() });
            queryClient.setQueryData(
                libraryQueryKey(library, search),
                getQueryUpdater((data: LibraryObj) => {
                    const currentElement = data.elements[element.id];
                    if (currentElement) {
                        currentElement.isOpenComposite =
                            !element.isOpenComposite;
                    }
                    return data;
                })
            );
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            router.invalidate();
        }
    });

    const setSupportsFastenMutation = useMutation({
        mutationKey: ["supports-fasten"],
        mutationFn: (supportsFasten: boolean) => {
            return apiPost(
                "/supports-fasten" +
                    toLibraryPath(library) +
                    toElementApiPath(element.path),
                {
                    body: {
                        supportsFasten
                    }
                }
            );
        },
        onSuccess: (_result, supportsFasten: boolean) => {
            if (supportsFasten) {
                showSuccessToast("Successfully enabled Insert and fasten.");
            }
        },
        onError: getAppErrorHandler("Failed to enable Insert and fasten."),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: libraryQueryMatchKey() });
        }
    });

    const reloadThumbnailMutation = useMutation({
        mutationKey: ["thumbnail", "reload"],
        mutationFn: async () => {
            return apiPost(
                "/reload-thumbnail" +
                    toLibraryPath(library) +
                    toElementApiPath(element.path),
                {
                    body: { microversionId: element.microversionId }
                }
            );
        },
        onError: getAppErrorHandler("Unexpectedly failed to reload thumbnail."),
        onSuccess: () => {
            showSuccessToast("Successfully reloaded thumbnail.");
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["storage-thumbnail"]
            });
            router.invalidate();
        }
    });

    return (
        <>
            <MenuItem
                onClick={() => {
                    setVisibilityMutation.mutate();
                }}
                intent={element.isVisible ? "danger" : "primary"}
                icon={element.isVisible ? "eye-off" : "eye-open"}
                text={element.isVisible ? "Hide element" : "Show element"}
            />
            {element.elementType === ElementType.PART_STUDIO && (
                <MenuItem
                    onClick={() => {
                        setOpenCompositeMutation.mutate();
                    }}
                    intent={element.isOpenComposite ? "warning" : undefined}
                    icon={element.isOpenComposite ? "disable" : "confirm"}
                    text={
                        element.isOpenComposite
                            ? "No open composites"
                            : "Has open composite"
                    }
                />
            )}
            <MenuItem
                onClick={() => {
                    setSupportsFastenMutation.mutate(!element.supportsFasten);
                }}
                intent={element.supportsFasten ? "danger" : "primary"}
                icon={element.supportsFasten ? "disable" : "add"}
                text={
                    element.supportsFasten
                        ? "Disable insert and fasten"
                        : "Enable Insert and fasten"
                }
            />
            <MenuItem
                onClick={() => {
                    reloadThumbnailMutation.mutate();
                }}
                icon="refresh"
                text="Reload thumbnail"
            />
        </>
    );
}
