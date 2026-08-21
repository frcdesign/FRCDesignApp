import { encodeCanonicalConfiguration } from "@backend/features/configurations/canonical";
import { Menu } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import {
    Favorite,
    getFavoriteForInsertable
} from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { ParameterValues } from "@backend/features/configurations/models";
import { SearchHit } from "../../search/search";
import {
    FavoriteButton,
    FavoriteInsertableItem
} from "../../favorites/components/favorite-button";
import { useIsInsertableHidden } from "../card-hooks";
import { InsertableStatusBadge } from "../../build-status/components/build-status";
import {
    AdminOptionsSubmenu,
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    QuickInsertItems,
    ReloadThumbnailMenuItem
} from "./card-components";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { openInsertMenu } from "../../insert/open-insert-menu";
import { useFavoritesQuery } from "../../favorites/queries";
import { RequireSignIn } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";

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
                    smallThumbnailUrl={insertable.smallThumbnailUrl}
                    largeThumbnailUrl={insertable.largeThumbnailUrl}
                    thumbnailTarget={{
                        elementId: insertable.elementId,
                        microversionId: insertable.microversionId,
                        canonicalConfiguration: encodeCanonicalConfiguration(
                            searchHit?.configuration ?? {}
                        ),
                        // A cold search would otherwise start a render per row.
                        warm: false
                    }}
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
                <RequireSignIn>
                    <FavoriteButton
                        favorite={favorite}
                        insertable={insertable}
                    />
                </RequireSignIn>
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
    const isConnected = useIsConnectedToOnshape();

    return (
        <>
            {!inInsertMenu && isConnected && (
                <>
                    <QuickInsertItems
                        insertable={insertable}
                        isFavorite={favorite !== undefined}
                    />
                    <Menu.Divider />
                </>
            )}
            <RequireSignIn>
                <FavoriteInsertableItem
                    favorite={favorite}
                    insertable={insertable}
                />
                <Menu.Divider />
            </RequireSignIn>
            <OpenDocumentItems path={{ ...insertable.path, configuration }} />
            <AdminOptionsSubmenu>
                <ReloadThumbnailMenuItem id={insertable.id} isGroup={false} />
            </AdminOptionsSubmenu>
        </>
    );
}
