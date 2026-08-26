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
import { InsertSource } from "@backend/features/analytics/events";

interface InsertableCardProps extends PropsWithChildren {
    insertable: InsertableOut;
    searchHit?: SearchHit;
    onClick?: () => void;
    /** Where this card is listed — browsing a group unless told otherwise. */
    source?: InsertSource;
}

/**
 * A card representing a part studio or assembly.
 */
export function InsertableCard(props: InsertableCardProps): ReactNode {
    const { insertable, searchHit, source = InsertSource.BROWSE } = props;

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

    const openMenu = () => {
        props.onClick?.();
        if (isAssemblyInPartStudio) {
            openCannotDeriveAssemblyAlert();
            return;
        }
        openInsertMenu({
            insertable,
            defaultConfiguration: hitConfiguration,
            source
        });
    };

    const thumbnail = (
        <CardThumbnail
            smallThumbnailUrl={insertable.smallThumbnailUrl}
            largeThumbnailUrl={insertable.largeThumbnailUrl}
            target={{
                elementId: insertable.elementId,
                microversionId: insertable.microversionId,
                canonicalConfiguration:
                    searchHit?.canonicalConfiguration ??
                    DEFAULT_CANONICAL_CONFIGURATION,
                // A cold search would otherwise start a render per row.
                renderThumbnail: false
            }}
        />
    );

    return (
        <ItemRow
            onClick={openMenu}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    searchHit={searchHit}
                    title={insertable.name}
                    thumbnail={thumbnail}
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
                        defaultConfiguration={hitConfiguration}
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
                    source={source}
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
    /** The same selection canonicalized, so favoriting can key its thumbnail. */
    canonicalConfiguration?: string;
    source: InsertSource;
}

export function InsertableMenuItems(
    props: InsertableMenuItemsProps
): ReactNode {
    const {
        favorite,
        insertable,
        inInsertMenu,
        configuration,
        canonicalConfiguration,
        source
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
                        source={source}
                    />
                    <Menu.Divider />
                </>
            )}
            <RequireSignIn>
                <FavoriteInsertableItem
                    favorite={favorite}
                    insertable={insertable}
                    defaultConfiguration={configuration}
                    canonicalConfiguration={canonicalConfiguration}
                />
                <Menu.Divider />
            </RequireSignIn>
            <OpenDocumentItems path={{ ...insertable.path, configuration }} />
        </>
    );
}
