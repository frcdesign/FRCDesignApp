import { DEFAULT_CONFIGURATION_KEY } from "@backend/features/configurations/contract";
import { ReactNode } from "react";
import { Favorite } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { openInsertMenu } from "../../insert/open-insert-menu";
import { FavoriteButton, FavoriteInsertableItem } from "./favorite-button";
import {
    CardTitle,
    ItemRow,
    type RowMatch
} from "../../../components/item-row";
import { OpenDocumentItems } from "../../../components/open-document-items";
import { QuickInsertItems } from "../../insert/components/quick-insert-items";
import { useIsInsertableHidden } from "../../library/visibility";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { ChangeOrderItems } from "../../../components/change-order";
import { MenuSection } from "../../../components/app-menu";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import {
    openCannotDeriveAssemblyAlert,
    openCannotReorderAlert
} from "../../../components/alerts";
import { useFavoritesQuery, useSetFavoriteOrderMutation } from "../queries";
import { SearchHit } from "../../search/search";
import { InsertSource } from "@backend/features/analytics/usage";
import { useVendorFilters } from "../../settings/components/vendor-filters";

interface FavoriteCardProps {
    insertable: InsertableOut;
    favorite: Favorite;
    searchHit?: SearchHit;
}

export function FavoriteCard(props: FavoriteCardProps): ReactNode {
    const { insertable, favorite, searchHit } = props;

    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden) {
        return null;
    }

    // From the favorite's own configuration, so it matches the thumbnail. Only
    // title underlining comes from the search.
    const rowMatch: RowMatch = {
        positions: searchHit?.positions ?? [],
        partNumber: favorite.record?.partNumber,
        partName: favorite.record?.name,
        url: favorite.record?.url
    };

    return (
        <ItemRow
            onClick={() => {
                if (isAssemblyInPartStudio) {
                    openCannotDeriveAssemblyAlert();
                    return;
                }
                openInsertMenu({
                    insertable,
                    initialSelection: favorite.defaultSelection,
                    configurationKey: favorite.configurationKey,
                    favoriteId: favorite.id,
                    source: InsertSource.FAVORITES
                });
            }}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    title={insertable.name}
                    thumbnail={
                        <CardThumbnail
                            smallThumbnailUrl={insertable.smallThumbnailUrl}
                            largeThumbnailUrl={insertable.largeThumbnailUrl}
                            target={{
                                elementId: insertable.elementId,
                                microversionId: insertable.microversionId,
                                configurationKey:
                                    favorite.configurationKey ??
                                    DEFAULT_CONFIGURATION_KEY,
                                insertableId: insertable.id
                            }}
                        />
                    }
                    match={rowMatch}
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

    const vendorFilters = useVendorFilters();
    const isConnected = useIsConnectedToOnshape();

    const setFavoriteOrderMutation = useSetFavoriteOrderMutation();
    const favoritesQuery = useFavoritesQuery();
    const favoriteOrder = favoritesQuery.data?.favoriteOrder ?? [];

    return (
        <>
            {isConnected && (
                <MenuSection label="Insert">
                    <QuickInsertItems
                        insertable={insertable}
                        selection={favorite.defaultSelection}
                        isFavorite
                        source={InsertSource.FAVORITES}
                    />
                </MenuSection>
            )}
            <MenuSection label="Favorites">
                <ChangeOrderItems
                    id={favorite.id}
                    order={favoriteOrder}
                    onOrderChange={(newOrder) => {
                        if (vendorFilters !== undefined) {
                            openCannotReorderAlert();
                            return;
                        }
                        setFavoriteOrderMutation.mutate(newOrder);
                    }}
                />
                <FavoriteInsertableItem
                    favorite={favorite}
                    insertable={insertable}
                />
            </MenuSection>
            <MenuSection label="Document">
                <OpenDocumentItems
                    path={insertable.path}
                    selection={favorite.defaultSelection}
                />
            </MenuSection>
        </>
    );
}
