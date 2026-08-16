import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Accordion } from "@mantine/core";
import { IconBook, IconSearch } from "@tabler/icons-react";
import {
    BORDER,
    IconSize,
    PrimaryColor
} from "../../../../common/style-constants";
import { ReactNode, useState } from "react";
import { GroupCard } from "../../../../groups/group-card";
import { ItemTable } from "../../../../cards/card-components";
import { HeartIcon } from "../../../../favorites/favorite-button";
import { SearchResults } from "../../../../search/search-results";
import {
    SectionError,
    SectionLoading
} from "../../../../app-common/app-zero-state";
import { RequireAccessLevel } from "../../../../api-utils/access-level";
import { AddGroupButton } from "../../../../groups/add-group-menu";
import { FavoritesList } from "../../../../favorites/favorites-list";
import { useLibraryQuery } from "../../../../queries";
import { getLibraryName, useLibraryId } from "../../../../api-utils/library";
import { updateUiState, useUiState } from "../../../../api-utils/ui-state";

export const Route = createFileRoute("/app/library/$libraryId/")({
    component: HomeList,
    onEnter: () => {
        updateUiState({ openGroupId: undefined });
    }
});

function HomeList(): ReactNode {
    const [uiState, setUiState] = useUiState();
    const [isSearchOpen, setIsSearchOpen] = useState(true);
    const libraryId = useLibraryId();

    const isSearch = !!uiState.searchQuery;
    const listKey = isSearch ? "search" : "library";

    const value: string[] = [];
    if (uiState.isFavoritesOpen) {
        value.push("favorites");
    }
    if (isSearch ? isSearchOpen : uiState.isLibraryOpen) {
        value.push(listKey);
    }

    const handleChange = (newValue: string[]) => {
        setUiState({ isFavoritesOpen: newValue.includes("favorites") });
        if (isSearch) {
            setIsSearchOpen(newValue.includes(listKey));
        } else {
            setUiState({ isLibraryOpen: newValue.includes(listKey) });
        }
    };

    const favoritesAccordion = (
        <Accordion.Item value="favorites">
            <Accordion.Control icon={<HeartIcon />} className="interactive">
                Favorites
            </Accordion.Control>
            <Accordion.Panel>
                <FavoritesList />
            </Accordion.Panel>
        </Accordion.Item>
    );

    let childAccordion: ReactNode;
    if (isSearch) {
        childAccordion = (
            <Accordion.Item key={listKey} value={listKey}>
                <Accordion.Control
                    className="interactive"
                    icon={
                        <IconSearch
                            size={IconSize.MEDIUM}
                            color={PrimaryColor.FILLED}
                        />
                    }
                >
                    Search Results
                </Accordion.Control>
                <Accordion.Panel>
                    <SearchResults
                        query={uiState.searchQuery}
                        filters={{ vendors: uiState.vendorFilters }}
                    />
                </Accordion.Panel>
            </Accordion.Item>
        );
    } else {
        childAccordion = (
            <Accordion.Item key={listKey} value={listKey}>
                <Accordion.Control
                    className="interactive"
                    icon={
                        <IconBook
                            size={IconSize.MEDIUM}
                            color={PrimaryColor.FILLED}
                        />
                    }
                >
                    {getLibraryName(libraryId)}
                </Accordion.Control>
                <Accordion.Panel>
                    <LibraryList />
                </Accordion.Panel>
            </Accordion.Item>
        );
    }

    return (
        <>
            <Accordion
                multiple
                variant="unstyled"
                value={value}
                onChange={handleChange}
                styles={{
                    content: {
                        padding: 0,
                        borderTop: BORDER,
                        borderBottom: BORDER
                    }
                }}
            >
                {favoritesAccordion}
                {childAccordion}
            </Accordion>
            <Outlet />
        </>
    );
}

function LibraryList() {
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isPending) {
        return <SectionLoading title="Loading groups..." />;
    } else if (libraryQuery.isError) {
        return <SectionError title="Failed to load groups." />;
    }

    const groups = libraryQuery.data.groups;
    const groupOrder = libraryQuery.data.groupOrder;

    if (groupOrder.length <= 0) {
        // Add an escape hatch for when no groups are in the database
        return (
            <SectionError
                title="No groups found"
                description={null}
                action={
                    <RequireAccessLevel>
                        <AddGroupButton />
                    </RequireAccessLevel>
                }
            />
        );
    }

    return (
        <ItemTable>
            {groupOrder.map((groupId) => {
                const group = groups[groupId];
                if (!group) {
                    return null;
                }
                return <GroupCard key={group.id} group={group} />;
            })}
        </ItemTable>
    );
}
