import { PropsWithChildren, ReactNode } from "react";
import { Favorite } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY,
    type PartialSelection
} from "@backend/features/configurations/contract";
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
import { AdminMenuSection, MenuSection } from "../../../components/app-menu";
import { ReloadThumbnailMenuItem } from "./reload-thumbnail-item";
import { QuickInsertItems } from "../../insert/components/quick-insert-items";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { openInsertMenu } from "../../insert/open-insert-menu";
import { useFavorite } from "../../favorites/queries";
import { RequireSignIn } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { InsertSource } from "@backend/features/analytics/usage";

interface InsertableMatch extends RowMatch {
    /** The values of the configuration it names, for the menu. */
    values?: PartialSelection;
    /** Their key, for the thumbnail. */
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

    // What the hit names, for inserting and for prefilling the menu.
    const hitSelection = match?.values;

    const openMenu = () => {
        props.onClick?.();
        if (isAssemblyInPartStudio) {
            openCannotDeriveAssemblyAlert();
            return;
        }
        openInsertMenu({
            insertable,
            initialSelection: hitSelection,
            configurationKey: match?.configurationKey,
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
                    match?.configurationKey ?? DEFAULT_CONFIGURATION_KEY
                // No insertableId: a cold search would otherwise start a render per row.
            }}
        />
    );

    const title = (
        <CardTitle
            disabled={isAssemblyInPartStudio}
            match={match}
            title={insertable.name}
            thumbnail={thumbnail}
            buildStatusBadge={
                <InsertableStatusBadge
                    insertableId={insertable.id}
                    groupId={insertable.groupId}
                    name={insertable.name}
                />
            }
        />
    );

    return (
        <ItemRow
            onClick={openMenu}
            left={title}
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
    /** A search hit's values on a card; the selected configuration inside the menu. */
    selection?: PartialSelection;
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
                <MenuSection label="Insert">
                    <QuickInsertItems
                        insertable={insertable}
                        selection={selection}
                        isFavorite={favorite !== undefined}
                        source={source}
                    />
                </MenuSection>
            )}
            <RequireSignIn>
                <MenuSection label="Favorites">
                    <FavoriteInsertableItem
                        favorite={favorite}
                        insertable={insertable}
                        selection={selection}
                        configurationKey={configurationKey}
                    />
                </MenuSection>
            </RequireSignIn>
            <MenuSection label="Document">
                <OpenDocumentItems
                    path={insertable.path}
                    selection={selection}
                />
            </MenuSection>
            <AdminMenuSection>
                <ReloadThumbnailMenuItem
                    target={{ insertableId: insertable.id }}
                />
            </AdminMenuSection>
        </>
    );
}
