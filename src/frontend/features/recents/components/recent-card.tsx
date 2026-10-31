import { DEFAULT_CONFIGURATION_KEY } from "@backend/features/configurations/contract";
import { Menu } from "@mantine/core";
import { XIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import type { RecentInsert } from "@backend/features/recents/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { InsertSource } from "@backend/features/analytics/usage";
import { openInsertMenu } from "../../insert/open-insert-menu";
import {
    FavoriteButton,
    FavoriteInsertableItem
} from "../../favorites/components/favorite-button";
import { useFavorite } from "../../favorites/queries";
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
import { MenuSection } from "../../../components/app-menu";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import { useRemoveRecentMutation } from "../queries";

interface RecentCardProps {
    insertable: InsertableOut;
    recent: RecentInsert;
}

export function RecentCard(props: RecentCardProps): ReactNode {
    const { insertable, recent } = props;

    const favorite = useFavorite(insertable.id);
    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden) {
        return null;
    }

    // The part number of the configuration last inserted, matching the thumbnail.
    const rowMatch: RowMatch = {
        positions: [],
        partNumber: recent.record?.partNumber,
        partName: recent.record?.name,
        url: recent.record?.url
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
                    initialSelection: recent.selection,
                    configurationKey: recent.configurationKey,
                    source: InsertSource.RECENTS
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
                                    recent.configurationKey ??
                                    DEFAULT_CONFIGURATION_KEY,
                                renderSource: {
                                    insertableId: insertable.id,
                                    selection: recent.selection ?? {}
                                }
                            }}
                        />
                    }
                    match={rowMatch}
                />
            }
            rightSection={
                <FavoriteButton
                    favorite={favorite}
                    insertable={insertable}
                    selection={recent.selection}
                    configurationKey={recent.configurationKey}
                />
            }
            menuItems={
                <RecentMenuItems insertable={insertable} recent={recent} />
            }
        />
    );
}

interface RecentMenuItemsProps {
    insertable: InsertableOut;
    recent: RecentInsert;
}

function RecentMenuItems(props: RecentMenuItemsProps): ReactNode {
    const { insertable, recent } = props;

    const favorite = useFavorite(insertable.id);
    const isConnected = useIsConnectedToOnshape();
    const removeRecentMutation = useRemoveRecentMutation();

    return (
        <>
            {isConnected && (
                <MenuSection label="Insert">
                    <QuickInsertItems
                        insertable={insertable}
                        selection={recent.selection}
                        isFavorite={favorite !== undefined}
                        source={InsertSource.RECENTS}
                    />
                </MenuSection>
            )}
            <MenuSection label="Recently used">
                <Menu.Item
                    leftSection={<XIcon />}
                    onClick={() => removeRecentMutation.mutate(insertable.id)}
                >
                    Remove
                </Menu.Item>
            </MenuSection>
            <MenuSection label="Favorites">
                <FavoriteInsertableItem
                    favorite={favorite}
                    insertable={insertable}
                    selection={recent.selection}
                    configurationKey={recent.configurationKey}
                />
            </MenuSection>
            <MenuSection label="Document">
                <OpenDocumentItems
                    path={insertable.path}
                    selection={recent.selection}
                />
            </MenuSection>
        </>
    );
}
