import { ReactNode, useState } from "react";
import {
    Favorite,
    FavoritesData,
    InsertableOut
} from "../../shared/api-models";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { Menu, TextInput } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { useRouter } from "@tanstack/react-router";
import { openInsertMenu } from "../insert/insert-menu";
import { openFavoriteMenu } from "./favorite-menu";
import { FavoriteButton, FavoriteInsertableItem } from "./favorite-button";
import {
    CardTitleGroup,
    ItemRow,
    OpenDocumentItems,
    QuickInsertItems
} from "../cards/card-components";
import { useIsInsertableHidden } from "../cards/card-hooks";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { ChangeOrderItems } from "../common/change-order";
import { useUiState } from "../api-utils/ui-state";
import {
    openCannotDeriveAssemblyAlert,
    openCannotEditDefaultConfigurationAlert,
    openCannotReorderAlert
} from "../app/alerts";
import { getAppErrorHandler } from "../api-utils/errors";
import { favoritesQueryKey, useFavoritesQuery } from "../queries";
import { produce } from "immer";
import { SearchHit } from "../search/insertable-search";
import { SearchHitTitle } from "../search/search-results";
import { toLibraryPath, useLibraryId } from "../api-utils/library";

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

    const uiState = useUiState()[0];

    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    const defaultTitle = favorite.name || insertable.name;
    const [favoriteName, setFavoriteName] = useState(defaultTitle);
    const updateFavoriteNameMutation = useUpdateFavoriteNameMutation();

    if (isHidden) {
        return null;
    }

    const saveFavoriteName = () => {
        const trimmedName = favoriteName.trim();
        if (trimmedName.length === 0) {
            setFavoriteName(defaultTitle);
            return;
        }
        if (trimmedName === defaultTitle) return;

        setFavoriteName(trimmedName);
        updateFavoriteNameMutation.mutate({
            favoriteId: favorite.id,
            name: trimmedName
        });
    };

    const isSearchActive = Boolean(uiState.searchQuery && searchHit);
    const titleComponent =
        isSearchActive && searchHit ? (
            <SearchHitTitle title={favoriteName} searchHit={searchHit} />
        ) : (
            <TextInput
                value={favoriteName}
                placeholder="Rename favorite"
                size="xs"
                radius="sm"
                onChange={(event) => setFavoriteName(event.currentTarget.value)}
                onBlur={saveFavoriteName}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur();
                    }
                }}
                onClick={(event) => event.stopPropagation()}
                onFocus={(event) => event.stopPropagation()}
                styles={{ input: { minWidth: 0 } }}
                style={{
                    width: "50%",
                    maxWidth: "100%",
                    minWidth: 0
                }}
            />
        );

    return (
        <ItemRow
            onClick={() => {
                if (isAssemblyInPartStudio) {
                    openCannotDeriveAssemblyAlert();
                    return;
                }
                openInsertMenu({
                    insertable,
                    defaultConfiguration: favorite.defaultConfiguration
                });
            }}
            left={
                <CardTitleGroup
                    disabled={isAssemblyInPartStudio}
                    title={favoriteName}
                    titleComponent={titleComponent}
                    thumbnailUrls={insertable.thumbnailUrls}
                    searchHit={searchHit}
                />
            }
            rightSection={
                <FavoriteButton favorite={favorite} insertable={insertable} />
            }
            menuItems={
                <FavoriteMenuItems
                    insertable={insertable}
                    favorite={favorite}
                />
            }
        />
    );
}

interface FavoriteMenuItemsProps {
    insertable: InsertableOut;
    favorite: Favorite;
}

function FavoriteMenuItems(props: FavoriteMenuItemsProps): ReactNode {
    const { insertable, favorite } = props;

    const uiState = useUiState()[0];

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation();
    const favoriteOrder = useFavoritesQuery().data?.favoriteOrder ?? [];

    return (
        <>
            <QuickInsertItems
                insertable={insertable}
                configuration={favorite.defaultConfiguration}
                isFavorite
            />
            <Menu.Divider />
            <Menu.Item
                leftSection={<IconPencil size={IconSize.SMALL} />}
                onClick={() => {
                    if (insertable.configurationId === undefined) {
                        openCannotEditDefaultConfigurationAlert();
                        return;
                    }
                    openFavoriteMenu({
                        favoriteId: favorite.id,
                        insertableName: insertable.name,
                        defaultConfiguration: favorite.defaultConfiguration,
                        favorite: favorite
                    });
                }}
            >
                Edit default configuration
            </Menu.Item>
            <Menu.Divider />
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
            <OpenDocumentItems path={insertable.path} />
            <Menu.Divider />
            <FavoriteInsertableItem
                favorite={favorite}
                insertable={insertable}
            />
        </>
    );
}

function useSetFavoriteOrderMutation() {
    const libraryId = useLibraryId();
    const router = useRouter();

    const queryKey = favoritesQueryKey(libraryId);

    return useMutation({
        mutationKey: ["set-favorite-order"],
        mutationFn: async (favoriteOrder: string[]) => {
            return apiPost("/favorite-order" + toLibraryPath(libraryId), {
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

function useUpdateFavoriteNameMutation() {
    const libraryId = useLibraryId();
    const router = useRouter();

    const queryKey = favoritesQueryKey(libraryId);

    return useMutation({
        mutationKey: ["update-favorite-name"],
        mutationFn: async (args: { favoriteId: string; name: string }) => {
            return apiPost("/favorite/" + args.favoriteId, {
                body: { name: args.name }
            });
        },
        onMutate: async (args) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                produce((data?: FavoritesData) => {
                    if (!data) return undefined;
                    const fav = data.favorites[args.favoriteId];
                    if (fav) {
                        fav.name = args.name;
                    }
                    return data;
                })
            );
            void router.invalidate();
        },
        onError: getAppErrorHandler("Unexpectedly failed to rename favorite."),
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey });
            void router.invalidate();
        }
    });
}
