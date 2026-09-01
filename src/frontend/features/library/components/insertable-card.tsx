import { DEFAULT_CANONICAL_CONFIGURATION } from "@backend/features/configurations/canonical";
import { decodeConfiguration } from "@backend/features/configurations/utils";
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
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { InsertableStatusBadge } from "../../build-status/components/build-status";
import {
    CardTitle,
    ItemRow,
    OpenDocumentItems,
    QuickInsertItems
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
    // What the hit names, for inserting and for prefilling the menu; the
    // canonical form itself is what names its thumbnail.
    const hitConfiguration = searchHit?.canonicalConfiguration
        ? decodeConfiguration(searchHit.canonicalConfiguration)
        : undefined;

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
                    defaultConfiguration: hitConfiguration
                });
            }}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    searchHit={searchHit}
                    title={insertable.name}
                    thumbnail={
                        <CardThumbnail
                            smallThumbnailUrl={insertable.smallThumbnailUrl}
                            largeThumbnailUrl={insertable.largeThumbnailUrl}
                            target={{
                                elementId: insertable.elementId,
                                microversionId: insertable.microversionId,
                                canonicalConfiguration:
                                    searchHit?.canonicalConfiguration ??
                                    DEFAULT_CANONICAL_CONFIGURATION,
                                // A cold search would otherwise start a render
                                // per row.
                                renderThumbnail: false
                            }}
                        />
                    }
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
                        canonicalConfiguration={
                            searchHit?.canonicalConfiguration
                        }
                    />
                </RequireSignIn>
            }
            menuItems={
                <InsertableMenuItems
                    favorite={favorite}
                    insertable={insertable}
                    configuration={hitConfiguration}
                />
            }
        />
    );
}

interface InsertableMenuItemsProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
    inInsertMenu?: boolean;
    /** What quick insert inserts and "Open document" opens: a search hit's
     * configuration on a card, the selected one inside the insert menu. */
    configuration?: ParameterValues;
    /** What favoriting stores: the same selection, in its canonical spelling. */
    canonicalConfiguration?: string;
}

export function InsertableMenuItems(
    props: InsertableMenuItemsProps
): ReactNode {
    const {
        favorite,
        insertable,
        inInsertMenu,
        configuration,
        canonicalConfiguration
    } = props;
    const isConnected = useIsConnectedToOnshape();

    return (
        <>
            {!inInsertMenu && isConnected && (
                <>
                    <QuickInsertItems
                        insertable={insertable}
                        configuration={configuration}
                        isFavorite={favorite !== undefined}
                    />
                    <Menu.Divider />
                </>
            )}
            <RequireSignIn>
                <FavoriteInsertableItem
                    favorite={favorite}
                    insertable={insertable}
                    canonicalConfiguration={canonicalConfiguration}
                />
                <Menu.Divider />
            </RequireSignIn>
            <OpenDocumentItems path={{ ...insertable.path, configuration }} />
        </>
    );
}
