import { encodeCanonicalConfiguration } from "@backend/features/configurations/canonical";
import { ReactNode } from "react";
import { Favorite } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../../../lib/api-client";
import { queryClient } from "../../../lib/query-client";
import { Menu } from "@mantine/core";
import { PencilIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { openInsertMenu } from "../../insert/open-insert-menu";
import { openFavoriteMenu } from "../open-favorite-menu";
import { FavoriteButton, FavoriteInsertableItem } from "./favorite-button";
import {
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    QuickInsertItems
} from "../../library/components/card-components";
import { useIsInsertableHidden } from "../../library/card-hooks";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { ChangeOrderItems } from "../../../components/change-order";
import { useUiState } from "../../../lib/ui-state";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import {
    openCannotDeriveAssemblyAlert,
    openCannotEditDefaultConfigurationAlert,
    openCannotReorderAlert
} from "../../../components/alerts";
import { getAppErrorHandler } from "../../../lib/errors";
import { useFavoritesQuery } from "../queries";
import { favoritesQueryKey } from "../../../lib/query-keys";
import { useRefreshFavorites } from "../../../lib/refresh";
import { produce } from "immer";
import { SearchHit } from "../../search/search";
import { toLibraryPath, useLibraryId } from "../../library/library-path";

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

    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden) {
        return null;
    }

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
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    title={insertable.name}
                    smallThumbnailUrl={insertable.smallThumbnailUrl}
                    largeThumbnailUrl={insertable.largeThumbnailUrl}
                    thumbnailTarget={{
                        elementId: insertable.elementId,
                        microversionId: insertable.microversionId,
                        canonicalConfiguration: encodeCanonicalConfiguration(
                            favorite.defaultConfiguration ?? {}
                        ),
                        warm: true,
                        insertableId: insertable.id
                    }}
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
    const isConnected = useIsConnectedToOnshape();

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation();
    const favoriteOrder = useFavoritesQuery().data?.favoriteOrder ?? [];

    return (
        <>
            {isConnected && (
                <>
                    <QuickInsertItems
                        insertable={insertable}
                        configuration={favorite.defaultConfiguration}
                        isFavorite
                    />
                    <Menu.Divider />
                </>
            )}
            <Menu.Item
                leftSection={<PencilIcon size={IconSize.SMALL} />}
                onClick={() => {
                    if (!insertable.isConfigurable) {
                        openCannotEditDefaultConfigurationAlert();
                        return;
                    }
                    openFavoriteMenu({
                        favoriteId: favorite.id,
                        insertableName: insertable.name,
                        defaultConfiguration: favorite.defaultConfiguration
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
    const refreshFavorites = useRefreshFavorites();

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
            // No router.invalidate(): the route loader prefetches favorites,
            // and that fetch would race the mutation and undo this update.
        },
        onError: getAppErrorHandler(
            "Unexpectedly failed to reorder favorites."
        ),
        onSettled: refreshFavorites
    });
}
