import { Group } from "@mantine/core";
import { m } from "../../../paraglide/messages";
import { DEFAULT_CONFIGURATION_KEY } from "@backend/features/configurations/contract";
import { ReactNode } from "react";
import type { RecentInsert } from "@backend/features/recents/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { UseSource } from "@backend/features/analytics/usage";
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
import { QuickInsertButton } from "../../insert/components/quick-insert-button";
import { DownloadStepMenuSection } from "../../download/components/download-step-menu-section";
import { ConfigurationHoverCard } from "../../insert/components/configuration-hover-card";
import { useIsInsertableHidden } from "../../library/visibility";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { MenuSection } from "../../../components/app-menu";
import { openCannotDeriveAssemblyAlert } from "../../../components/alerts";
import { type SearchHit } from "../../search/search";

interface RecentCardProps {
    insertable: InsertableOut;
    recent: RecentInsert;
    /** Set when a search found this row, to underline what matched. */
    searchHit?: SearchHit;
}

export function RecentCard(props: RecentCardProps): ReactNode {
    const { insertable, recent, searchHit } = props;

    const favorite = useFavorite(insertable.id);
    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );

    if (isHidden) {
        return null;
    }

    // From the row's own configuration, so it matches the thumbnail; the
    // search, which read that configuration, only says where to underline.
    const rowMatch: RowMatch = {
        positions: searchHit?.positions ?? [],
        partNumberPositions: searchHit?.partNumberPositions,
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
                    source: UseSource.RECENTS
                });
            }}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    title={insertable.name}
                    badge={
                        <ConfigurationHoverCard
                            insertable={insertable}
                            selection={recent.selection}
                        />
                    }
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
            actions={
                <Group gap={4} wrap="nowrap">
                    <QuickInsertButton
                        insertable={insertable}
                        selection={recent.selection}
                        isFavorite={favorite !== undefined}
                        source={UseSource.RECENTS}
                    />
                    <FavoriteButton
                        favorite={favorite}
                        insertable={insertable}
                        selection={recent.selection}
                        configurationKey={recent.configurationKey}
                    />
                </Group>
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

    return (
        <>
            <DownloadStepMenuSection
                insertable={insertable}
                selection={recent.selection}
                isFavorite={favorite !== undefined}
                source={UseSource.RECENTS}
            />
            <MenuSection label={m.libraryMenuFavorites()}>
                <FavoriteInsertableItem
                    favorite={favorite}
                    insertable={insertable}
                    selection={recent.selection}
                    configurationKey={recent.configurationKey}
                />
            </MenuSection>
            <MenuSection label={m.libraryMenuDocument()}>
                <OpenDocumentItems
                    path={insertable.path}
                    selection={recent.selection}
                />
            </MenuSection>
        </>
    );
}
