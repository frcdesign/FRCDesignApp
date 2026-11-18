import { Group, Menu, Tooltip } from "@mantine/core";
import { UsersThreeIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY,
    type PartialSelection
} from "@backend/features/configurations/contract";
import type { Favorite } from "@backend/features/favorites/contract";
import type {
    InsertableOut,
    LibraryOut
} from "@backend/features/library/contract";
import { UseSource } from "@backend/features/analytics/usage";
import {
    CardTitle,
    ItemRow,
    ItemTable,
    type RowMatch
} from "../../../components/item-row";
import { ChangeOrderItems } from "../../../components/change-order";
import { MenuSection } from "../../../components/app-menu";
import { OpenDocumentItems } from "../../../components/open-document-items";
import {
    openCannotDeriveAssemblyAlert,
    openCannotReorderAlert
} from "../../../components/alerts";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { openInsertMenu } from "../../insert/open-insert-menu";
import { QuickInsertButton } from "../../insert/components/quick-insert-button";
import { ConfigurationHoverCard } from "../../insert/components/configuration-hover-card";
import { useIsAssemblyInPartStudio } from "../../insert/insert-hooks";
import { useIsInsertableHidden } from "../../library/visibility";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { filterInsertables } from "../../search/filter";
import { searchList } from "../../search/list-search";
import { type SearchHit } from "../../search/search";
import { useVendorFilters } from "../../settings/vendor-filters";
import {
    useCanEditTeamFavorites,
    useTeamFavoritesMutations,
    useTeamFavoritesQuery
} from "../queries";

interface TeamIconProps {
    /** @default IconSize.SMALL */
    size?: IconSize;
}

export function TeamIcon(props: TeamIconProps): ReactNode {
    const { size = IconSize.SMALL } = props;
    return (
        <Tooltip label={m.teamFavorite()}>
            <UsersThreeIcon
                size={size}
                weight="fill"
                color={PrimaryColor.FILLED}
            />
        </Tooltip>
    );
}

interface TeamFavoriteCardsProps {
    library: LibraryOut;
    /** Narrows them to what it matches, ranked, when set. */
    query?: string;
}

/** The current team's favorites, above the user's own; nothing off a team. */
export function TeamFavoriteCards(props: TeamFavoriteCardsProps): ReactNode {
    const { library, query } = props;
    const favoritesQuery = useTeamFavoritesQuery();
    const vendorFilters = useVendorFilters();
    const data = favoritesQuery.data;
    if (!data) return null;

    const rows = data.favoriteOrder.flatMap((favoriteId) => {
        const favorite = data.favorites[favoriteId];
        const insertable =
            favorite && library.insertables[favorite.insertableId];
        return insertable
            ? [
                  {
                      id: favorite.id,
                      insertable,
                      favorite,
                      groupName: library.groups[insertable.groupId]?.name ?? "",
                      record: favorite.record
                  }
              ]
            : [];
    });
    const found = query
        ? searchList(rows, query)
        : rows.map((row) => ({ row, hit: undefined as SearchHit | undefined }));
    const kept = new Set(
        filterInsertables(
            found.map(({ row }) => row.insertable),
            { vendors: vendorFilters, visibleOnly: true }
        ).insertables.map((insertable) => insertable.id)
    );
    const shown = found.filter(({ row }) => kept.has(row.insertable.id));
    if (shown.length === 0) return null;

    return (
        <ItemTable>
            {shown.map(({ row, hit }) => (
                <TeamFavoriteCard
                    key={row.id}
                    insertable={row.insertable}
                    favorite={row.favorite}
                    order={data.favoriteOrder}
                    searchHit={hit}
                />
            ))}
        </ItemTable>
    );
}

interface TeamFavoriteCardProps {
    insertable: InsertableOut;
    favorite: Favorite;
    order: string[];
    searchHit?: SearchHit;
}

function TeamFavoriteCard(props: TeamFavoriteCardProps): ReactNode {
    const { insertable, favorite, order, searchHit } = props;
    const isHidden = useIsInsertableHidden(insertable);
    const isAssemblyInPartStudio = useIsAssemblyInPartStudio(
        insertable.elementType
    );
    const canEdit = useCanEditTeamFavorites();
    const vendorFilters = useVendorFilters();
    const { remove, reorder } = useTeamFavoritesMutations();
    if (isHidden) return null;

    const match: RowMatch = {
        positions: searchHit?.positions ?? [],
        partNumberPositions: searchHit?.partNumberPositions,
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
                    source: UseSource.TEAM_FAVORITES
                });
            }}
            left={
                <CardTitle
                    disabled={isAssemblyInPartStudio}
                    title={insertable.name}
                    badge={
                        <Group gap={4} wrap="nowrap">
                            <TeamIcon />
                            <ConfigurationHoverCard
                                insertable={insertable}
                                selection={favorite.defaultSelection}
                            />
                        </Group>
                    }
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
                                renderSource: {
                                    insertableId: insertable.id,
                                    selection: favorite.defaultSelection ?? {}
                                }
                            }}
                        />
                    }
                    match={match}
                />
            }
            actions={
                <QuickInsertButton
                    insertable={insertable}
                    selection={favorite.defaultSelection}
                    isFavorite={false}
                    source={UseSource.TEAM_FAVORITES}
                />
            }
            menuItems={
                <>
                    {canEdit && (
                        <MenuSection label={m.teamFavorites()}>
                            <ChangeOrderItems
                                id={favorite.id}
                                order={order}
                                onOrderChange={(newOrder) => {
                                    if (vendorFilters !== undefined) {
                                        openCannotReorderAlert();
                                        return;
                                    }
                                    reorder.mutate(newOrder);
                                }}
                            />
                            <Menu.Item
                                color="red"
                                leftSection={<UsersThreeIcon />}
                                onClick={() => remove.mutate(favorite.id)}
                            >
                                {m.teamFavoriteRemove()}
                            </Menu.Item>
                        </MenuSection>
                    )}
                    <MenuSection label={m.libraryMenuDocument()}>
                        <OpenDocumentItems
                            path={insertable.path}
                            selection={favorite.defaultSelection}
                        />
                    </MenuSection>
                </>
            }
        />
    );
}

interface TeamFavoriteItemProps {
    insertable: InsertableOut;
    selection?: PartialSelection;
    configurationKey?: ConfigurationKey;
}

/** A part's menu item adding it to, or removing it from, the team's favorites. */
export function TeamFavoriteItem(props: TeamFavoriteItemProps): ReactNode {
    const { insertable, selection, configurationKey } = props;
    const canEdit = useCanEditTeamFavorites();
    const data = useTeamFavoritesQuery().data;
    const { add, remove } = useTeamFavoritesMutations();
    if (!canEdit || !data) return null;
    const existing = Object.values(data.favorites).find(
        (favorite) => favorite.insertableId === insertable.id
    );
    return (
        <Menu.Item
            leftSection={<UsersThreeIcon />}
            color={existing ? "red" : undefined}
            onClick={() =>
                existing
                    ? remove.mutate(existing.id)
                    : add.mutate({ insertable, selection, configurationKey })
            }
        >
            {existing ? m.teamFavoriteRemove() : m.teamFavoriteAdd()}
        </Menu.Item>
    );
}
