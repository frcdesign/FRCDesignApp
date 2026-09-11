import { decodeConfiguration } from "@backend/features/configurations/utils";
import { Menu } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import { Favorite } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY,
    Selection
} from "@backend/features/configurations/models";
import {
    FavoriteButton,
    FavoriteInsertableItem
} from "../../favorites/components/favorite-button";
import { useIsInsertableHidden } from "../visibility";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { InsertableStatusBadge } from "../../build-status/components/build-status";
import {
    CardTitle,
    ItemRow,
    type RowMatch
} from "../../../components/item-row";
import { OpenDocumentItems } from "../../../components/open-document-items";
import { QuickInsertItems } from "../../insert/components/quick-insert-items";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { openInsertMenu } from "../../insert/open-insert-menu";
import { useFavorite } from "../../favorites/queries";
import { RequireSignIn } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { InsertSource } from "@backend/features/analytics/events";

/**
 * What a search found in this row. Structural rather than the search feature's
 * own `SearchHit`, which a card has no other reason to know about.
 */
interface InsertableMatch extends RowMatch {
    /** The key of the selection it names, for the thumbnail and the menu. */
    configurationKey?: ConfigurationKey;
}

interface InsertableCardProps extends PropsWithChildren {
    insertable: InsertableOut;
    /** Set when a search found this row, to underline what matched. */
    match?: InsertableMatch;
    onClick?: () => void;
    /** Where this card is listed — browsing a group unless told otherwise. */
    source?: InsertSource;
}

/**
 * A card representing a part studio or assembly.
 */
export function InsertableCard(props: InsertableCardProps): ReactNode {
    const { insertable, match, source = InsertSource.BROWSE } = props;

    const favorite = useFavorite(insertable.id);

    const isHidden = useIsInsertableHidden(insertable);

    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden) {
        return null;
    }

    // What the hit names, for inserting and for prefilling the menu; its key
    // is what names the thumbnail.
    const hitSelection = match?.configurationKey
        ? decodeConfiguration(match.configurationKey)
        : undefined;

    const openMenu = () => {
        props.onClick?.();
        if (isAssemblyInPartStudio) {
            openCannotDeriveAssemblyAlert();
            return;
        }
        openInsertMenu({
            insertable,
            initialSelection: hitSelection,
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
                configurationKey:
                    match?.configurationKey ?? DEFAULT_CONFIGURATION_KEY,
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
                    match={match}
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
                        selection={hitSelection}
                        configurationKey={match?.configurationKey}
                    />
                </RequireSignIn>
            }
            menuItems={
                <InsertableMenuItems
                    favorite={favorite}
                    insertable={insertable}
                    selection={hitSelection}
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
     * selection on a card, the selected one inside the insert menu. */
    selection?: Selection;
    /** That selection's key, so favoriting can name its thumbnail. */
    configurationKey?: ConfigurationKey;
    source: InsertSource;
}

export function InsertableMenuItems(
    props: InsertableMenuItemsProps
): ReactNode {
    const {
        favorite,
        insertable,
        inInsertMenu,
        selection,
        configurationKey,
        source
    } = props;
    const isConnected = useIsConnectedToOnshape();

    return (
        <>
            {!inInsertMenu && isConnected && (
                <>
                    <QuickInsertItems
                        insertable={insertable}
                        selection={selection}
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
                    selection={selection}
                    configurationKey={configurationKey}
                />
                <Menu.Divider />
            </RequireSignIn>
            <OpenDocumentItems path={{ ...insertable.path, selection }} />
        </>
    );
}
