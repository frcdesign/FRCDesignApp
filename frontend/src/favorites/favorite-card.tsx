import { ReactNode } from "react";
import { ElementObj, Favorite, LibraryUserData } from "../api/models";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import {
    Card,
    ContextMenu,
    ContextMenuChildrenProps,
    Menu,
    MenuDivider,
    MenuItem
} from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MenuType } from "../overlays/menu-params";
import { FavoriteButton, FavoriteElementItem } from "./favorite-button";
import {
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems,
    QuickInsertItems
} from "../cards/card-components";
import { useIsElementHidden } from "../cards/card-hooks";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { ChangeOrderItems } from "../cards/change-order";
import { toUserApiPath } from "../api/path";
import { useUiState } from "../api/ui-state";
import { router } from "../router";
import { AppPopup, useOpenAlert } from "../overlays/popup-params";
import { getAppErrorHandler } from "../api/errors";
import { useLibraryUserDataQuery } from "../queries";
import { produce } from "immer";
import { SearchHit } from "../search/search";
import { toLibraryPath, useLibrary } from "../api/library";

interface FavoriteCardProps {
    element: ElementObj;
    favorite: Favorite;
    searchHit?: SearchHit;
}

/**
 * A card for displaying a Favorited element directly to the user.
 * Very similar in nature to an ElementCard but with a few tweaks.
 */
export function FavoriteCard(props: FavoriteCardProps): ReactNode {
    const { element, favorite, searchHit } = props;

    const navigate = useNavigate();

    const isHidden = useIsElementHidden(element);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        element.elementType
    );
    const openAlert = useOpenAlert();

    if (isHidden) {
        return null;
    }

    return (
        <FavoriteContextMenu element={element} favorite={favorite}>
            {(ctxMenuProps: ContextMenuChildrenProps) => (
                <>
                    <Card
                        className="item-card"
                        onContextMenu={ctxMenuProps.onContextMenu}
                        ref={ctxMenuProps.ref}
                        interactive
                        onClick={() => {
                            if (isAssemblyInPartStudio) {
                                openAlert(AppPopup.CANNOT_DERIVE_ASSEMBLY);
                                return;
                            }
                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: MenuType.INSERT_MENU,
                                    activeElementId: element.id,
                                    defaultConfiguration:
                                        favorite.defaultConfiguration
                                }
                            });
                        }}
                    >
                        <CardTitle
                            disabled={isAssemblyInPartStudio}
                            title={element.name}
                            thumbnailUrls={element.thumbnailUrls}
                            searchHit={searchHit}
                        />
                        <div className="item-card-right-content">
                            <FavoriteButton isFavorite element={element} />
                            <ContextMenuButton
                                onClick={ctxMenuProps.onContextMenu}
                            />
                        </div>
                    </Card>
                    {ctxMenuProps.popover}
                </>
            )}
        </FavoriteContextMenu>
    );
}

interface FavoriteContextMenuProps {
    element: ElementObj;
    favorite: Favorite;
    children: any;
}

function FavoriteContextMenu(props: FavoriteContextMenuProps): ReactNode {
    const { children, element, favorite } = props;

    const uiState = useUiState()[0];
    const navigate = useNavigate();

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation();
    const favoriteOrder = useLibraryUserDataQuery().data?.favoriteOrder ?? [];
    const openAlert = useOpenAlert();

    const menu = (
        <Menu>
            <QuickInsertItems
                element={element}
                defaultConfiguration={favorite.defaultConfiguration}
                isFavorite
            />
            <MenuDivider />
            <MenuItem
                icon="edit"
                text="Edit default configuration"
                intent="primary"
                onClick={() => {
                    if (element.configurationId === undefined) {
                        openAlert(AppPopup.CANNOT_EDIT_DEFAULT_CONFIGURATION);
                        return;
                    }
                    navigate({
                        to: ".",
                        search: {
                            activeMenu: MenuType.FAVORITE_MENU,
                            favoriteId: favorite.id,
                            defaultConfiguration: favorite.defaultConfiguration
                        }
                    });
                }}
            />
            <MenuDivider />
            <ChangeOrderItems
                id={favorite.id}
                order={favoriteOrder}
                onOrderChange={(newOrder) => {
                    if (uiState.vendorFilters !== undefined) {
                        openAlert(AppPopup.CANNOT_REORDER);
                        return;
                    }
                    setFavoriteOrderMutation.mutate(newOrder);
                }}
            />
            {/* Only show second divider when we have more than one favorite since otherwise there's no reorder items */}
            {favoriteOrder.length > 1 && <MenuDivider />}
            <OpenDocumentItems path={element} />
            <MenuDivider />
            <FavoriteElementItem isFavorite element={element} />
        </Menu>
    );
    return <ContextMenu content={menu}>{children}</ContextMenu>;
}

function useSetFavoriteOrderMutation() {
    const userPath = useSearch({ from: "/app" });
    const library = useLibrary();
    return useMutation({
        mutationKey: ["set-favorite-order"],
        mutationFn: async (favoriteOrder: string[]) => {
            return apiPost(
                "/favorite-order" +
                    toLibraryPath(library) +
                    toUserApiPath(userPath),
                {
                    body: { favoriteOrder }
                }
            );
        },
        onMutate: async (newOrder: string[]) => {
            await queryClient.cancelQueries({
                queryKey: ["library-user-data"]
            });
            queryClient.setQueryData(
                ["library-user-data"],
                produce((data?: LibraryUserData) => {
                    if (!data) {
                        return undefined;
                    }
                    data.favoriteOrder = newOrder;
                    return data;
                })
            );
            router.invalidate();
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to reorder favorites."
        ),
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["library-user-data"]
            });
            router.invalidate();
        }
    });
}
