import { ReactNode } from "react";
import { InsertableOut, Favorite } from "../../shared/api-models";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { Card } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useContextMenu } from "mantine-contextmenu";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { MenuType } from "../overlays/menu-params";
import { FavoriteButton, FavoriteInsertableItem } from "./favorite-button";
import {
    CardTitle,
    ContextMenuButton,
    OpenDocumentItems,
    QuickInsertItems
} from "../cards/card-components";
import { useIsInsertableHidden } from "../cards/card-hooks";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { ChangeOrderItems } from "../cards/change-order";
import { useUiState } from "../api-utils/ui-state";
import {
    openCannotDeriveAssemblyAlert,
    openCannotEditDefaultConfigurationAlert,
    openCannotReorderAlert
} from "../overlays/alerts";
import { getAppErrorHandler } from "../api-utils/errors";
import { favoritesQueryKey, useFavoritesQuery } from "../queries";
import { produce } from "immer";
import { SearchHit } from "../search/search";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { AppMenu, AppMenuDivider, AppMenuItem } from "../common/app-menu";

interface FavoriteCardProps {
    insertable: InsertableOut;
    favorite: Favorite;
    searchHit?: SearchHit;
}

/**
 * A card for displaying a favorited insertable directly to the user.
 * Very similar in nature to an InsertableCard but with a few tweaks.
 */
export function FavoriteCard(props: FavoriteCardProps): ReactNode {
    const { insertable, favorite, searchHit } = props;

    const navigate = useNavigate();
    const { showContextMenu } = useContextMenu();

    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden) {
        return null;
    }

    const menuContent = (close: () => void) => (
        <FavoriteMenu
            insertable={insertable}
            favorite={favorite}
            close={close}
        />
    );

    return (
        <Card
            withBorder
            padding="sm"
            radius="md"
            className="item-card"
            style={{ cursor: "pointer" }}
            onContextMenu={showContextMenu(menuContent)}
            onClick={() => {
                if (isAssemblyInPartStudio) {
                    openCannotDeriveAssemblyAlert();
                    return;
                }
                void navigate({
                    to: ".",
                    search: {
                        activeMenu: MenuType.INSERT_MENU,
                        activeInsertableId: insertable.id,
                        defaultConfiguration: favorite.defaultConfiguration
                    }
                });
            }}
        >
            <CardTitle
                disabled={isAssemblyInPartStudio}
                title={insertable.name}
                thumbnailUrls={insertable.thumbnailUrls}
                searchHit={searchHit}
            />
            <div className="item-card-right-content">
                <FavoriteButton favorite={favorite} insertable={insertable} />
                <ContextMenuButton onClick={showContextMenu(menuContent)} />
            </div>
        </Card>
    );
}

interface FavoriteMenuProps {
    insertable: InsertableOut;
    favorite: Favorite;
    close: () => void;
}

function FavoriteMenu(props: FavoriteMenuProps): ReactNode {
    const { insertable, favorite, close } = props;

    const uiState = useUiState()[0];
    const navigate = useNavigate();

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation();
    const favoriteOrder = useFavoritesQuery().data?.favoriteOrder ?? [];

    return (
        <AppMenu close={close}>
            <QuickInsertItems
                insertable={insertable}
                configuration={favorite.defaultConfiguration}
                isFavorite
            />
            <AppMenuDivider />
            <AppMenuItem
                icon={<IconPencil size={16} />}
                color="blue"
                onClick={() => {
                    if (insertable.configurationId === undefined) {
                        openCannotEditDefaultConfigurationAlert();
                        return;
                    }
                    void navigate({
                        to: ".",
                        search: {
                            activeMenu: MenuType.FAVORITE_MENU,
                            favoriteId: favorite.id,
                            defaultConfiguration: favorite.defaultConfiguration
                        }
                    });
                }}
            >
                Edit default configuration
            </AppMenuItem>
            <AppMenuDivider />
            <ChangeOrderItems
                id={favorite.id}
                order={favoriteOrder}
                onOrderChange={(newOrder) => {
                    if (uiState.vendorFilters !== undefined) {
                        openCannotReorderAlert();
                        return;
                    }
                    setFavoriteOrderMutation.mutate(newOrder);
                }}
            />
            {/* Only show second divider when we have more than one favorite since otherwise there's no reorder items */}
            {favoriteOrder.length > 1 && <AppMenuDivider />}
            <OpenDocumentItems path={insertable.path} />
            <AppMenuDivider />
            <FavoriteInsertableItem
                favorite={favorite}
                insertable={insertable}
            />
        </AppMenu>
    );
}

function useSetFavoriteOrderMutation() {
    const library = useLibrary();
    const router = useRouter();

    const queryKey = favoritesQueryKey(library);

    return useMutation({
        mutationKey: ["set-favorite-order"],
        mutationFn: async (favoriteOrder: string[]) => {
            return apiPost("/favorite-order" + toLibraryPath(library), {
                body: { favoriteOrder }
            });
        },
        onMutate: async (newOrder: string[]) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                produce((data?: { favoriteOrder: string[] }) => {
                    if (!data) return undefined;
                    data.favoriteOrder = newOrder;
                    return data;
                })
            );
            void router.invalidate();
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to reorder favorites."
        ),
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey });
            void router.invalidate();
        }
    });
}
