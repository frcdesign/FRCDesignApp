import { Menu } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import {
    Favorite,
    getFavoriteForInsertable,
    InsertableOut
} from "../../shared/api-models";
import { ParameterValues } from "../../shared/configuration-models";
import { SearchHit } from "../search/search";
import {
    FavoriteButton,
    FavoriteInsertableItem
} from "../favorites/favorite-button";
import { useIsInsertableHidden } from "./card-hooks";
import { InsertableStatusBadge } from "./build-status";
import {
    AdminOptionsSubmenu,
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    QuickInsertItems,
    ReloadThumbnailMenuItem
} from "./card-components";
import { openCannotDeriveAssemblyAlert } from "../app/alerts";
import { useIsAssemblyInPartStudio } from "../insert/insert-hooks";
import { openInsertMenu } from "../insert/insert-menu";
import { useFavoritesQuery } from "../queries";

interface InsertableCardProps extends PropsWithChildren {
    insertable: InsertableOut;
    searchHit?: SearchHit;
    onClick?: () => void;
}

/**
 * A card representing a part studio or assembly.
 */
export function InsertableCard(props: InsertableCardProps): ReactNode {
    const { insertable, searchHit } = props;

    const favorites = useFavoritesQuery().data?.favorites;

    const isHidden = useIsInsertableHidden(insertable);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden || !favorites) {
        return null;
    }

    const favorite = getFavoriteForInsertable(favorites, insertable.id);

    return (
        <ItemRow
            onClick={() => {
                if (props.onClick) {
                    props.onClick();
                }

                if (isAssemblyInPartStudio) {
                    openCannotDeriveAssemblyAlert();
                    return;
                }

                openInsertMenu({
                    insertable,
                    defaultConfiguration: searchHit?.configuration
                });
            }}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    searchHit={searchHit}
                    title={insertable.name}
                    thumbnailUrls={insertable.thumbnailUrls}
                    showHiddenTag={!insertable.isVisible}
                    buildStatusBadge={
                        <InsertableStatusBadge
                            insertableId={insertable.id}
                            name={insertable.name}
                        />
                    }
                />
            }
            rightSection={
                <FavoriteButton favorite={favorite} insertable={insertable} />
            }
            menuItems={
                <InsertableMenuItems
                    favorite={favorite}
                    insertable={insertable}
                />
            }
        />
    );
}

interface InsertableMenuItemsProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
    inInsertMenu?: boolean;
    configuration?: ParameterValues;
}

export function InsertableMenuItems(
    props: InsertableMenuItemsProps
): ReactNode {
    const { favorite, insertable, inInsertMenu, configuration } = props;

    return (
        <>
            {!inInsertMenu && (
                <>
                    <QuickInsertItems
                        insertable={insertable}
                        isFavorite={favorite !== undefined}
                    />
                    <Menu.Divider />
                </>
            )}
            <FavoriteInsertableItem
                favorite={favorite}
                insertable={insertable}
            />
            <Menu.Divider />
            <OpenDocumentItems path={{ ...insertable.path, configuration }} />
            <AdminOptionsSubmenu>
                <ReloadThumbnailMenuItem id={insertable.id} isGroup={false} />
            </AdminOptionsSubmenu>
        </>
    );
}
