import { ReactNode } from "react";
import { copyUserData, ElementObj, Favorite, UserData } from "../api/models";
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
import { MenuType } from "../search-params/menu-params";
import { FavoriteButton, FavoriteElementItem } from "./favorite-button";
import {
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems,
    QuickInsertItem
} from "../cards/card-components";
import { useIsElementHidden } from "../cards/card-hooks";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { ChangeOrderItems } from "../cards/change-order";
import { toUserApiPath, UserPath } from "../api/path";
import { useUiState } from "../api/ui-state";
import { useUserData } from "../queries";
import { router } from "../router";
import { AlertType, useOpenAlert } from "../search-params/alert-type";
import { getAppErrorHandler } from "../api/errors";

interface FavoriteCardProps {
    element: ElementObj;
    favorite: Favorite;
}

/**
 * A card for displaying a Favorited element directly to the user.
 * Very similar in nature to an ElementCard but with a few tweaks.
 */
export function FavoriteCard(props: FavoriteCardProps): ReactNode {
    const { element, favorite } = props;

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
                                openAlert(AlertType.CANNOT_DERIVE_ASSEMBLY);
                                return;
                            }
                            navigate({
                                to: ".",
                                search: {
                                    activeMenu: MenuType.INSERT_MENU,
                                    activeElementId: element.elementId,
                                    defaultConfiguration:
                                        favorite.defaultConfiguration
                                }
                            });
                        }}
                    >
                        <CardTitle
                            disabled={isAssemblyInPartStudio}
                            title={element.name}
                            elementPath={element}
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

    const search = useSearch({ from: "/app" });
    const uiState = useUiState()[0];
    const navigate = useNavigate();

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation(search);
    const favoriteOrder = useUserData().favoriteOrder;
    const openAlert = useOpenAlert();

    const menu = (
        <Menu>
            <QuickInsertItem
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
                        openAlert(AlertType.CANNOT_EDIT_DEFAULT_CONFIGURATION);
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
                        openAlert(AlertType.CANNOT_REORDER);
                        return;
                    }
                    setFavoriteOrderMutation.mutate(newOrder);
                }}
            />
            <MenuDivider />
            <OpenDocumentItems path={element} />
            <MenuDivider />
            <FavoriteElementItem isFavorite element={element} />
        </Menu>
    );
    return <ContextMenu content={menu}>{children}</ContextMenu>;
}

function useSetFavoriteOrderMutation(userPath: UserPath) {
    return useMutation({
        mutationKey: ["set-favorite-order"],
        mutationFn: async (favoriteOrder: string[]) => {
            return apiPost("/favorite-order" + toUserApiPath(userPath), {
                body: { favoriteOrder }
            });
        },
        onMutate: async (newOrder: string[]) => {
            await queryClient.cancelQueries({ queryKey: ["user-data"] });
            queryClient.setQueryData(["user-data"], (data?: UserData) => {
                if (!data) {
                    return undefined;
                }
                const newUserData = copyUserData(data);
                newUserData.favoriteOrder = newOrder;
                return newUserData;
            });
            router.invalidate();
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to reorder favorites."
        ),
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: ["user-data"] });
            router.invalidate();
        }
    });
}
