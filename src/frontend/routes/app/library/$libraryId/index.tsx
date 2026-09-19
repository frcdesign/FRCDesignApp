import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Badge } from "@mantine/core";
import { AppSection, AppSections } from "../../../../components/app-section";
import { AppTitle } from "../../../../components/app-title";
import { BooksIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { IconSize, PrimaryColor } from "../../../../lib/style-constants";
import { ReactNode, useState } from "react";
import { GroupCard } from "../../../../features/library/components/group-card";
import { ItemTable } from "../../../../components/item-row";
import { FavoriteIcon } from "../../../../features/favorites/components/favorite-button";
import { SearchResults } from "../../../../features/search/components/search-results";
import { InsertSource } from "@backend/features/analytics/usage";
import {
    SectionNotice,
    SectionLoading
} from "../../../../components/app-zero-state";
import { RequireAccessLevel } from "../../../../features/auth/access-level";
import { AddGroupButton } from "../../../../features/library/components/add-group-menu";
import { FavoritesList } from "../../../../features/favorites/components/favorites-list";
import { useLibraryQuery } from "../../../../features/library/queries";
import {
    getLibraryName,
    getLibraryStatus,
    useLibraryId
} from "../../../../lib/library";
import { useGetUiState, updateUiState } from "../../../../lib/ui-state";
import { useVendorFilters } from "../../../../features/settings/components/vendor-filters";

export const Route = createFileRoute("/app/library/$libraryId/")({
    component: HomeList,
    // Back in the library itself, which is where entry should resume.
    onEnter: () => {
        updateUiState({ groupId: null });
    }
});

/** One accordion section: what it shows, and where its open state lives. */
interface Section {
    value: string;
    /** Names the section, and titles it where `title` is left out. */
    name: string;
    icon: ReactNode;
    /** A title of its own, for a section whose header carries more than a name. */
    title?: ReactNode;
    panel: ReactNode;
    opened: boolean;
    setOpened: (opened: boolean) => void;
}

/** The sections the home list shows, in the order they are stacked. */
function useHomeSections(): Section[] {
    const uiState = useGetUiState();
    // Not persisted: search results open on every visit, unlike the library.
    const [isSearchOpen, setIsSearchOpen] = useState(true);
    const libraryId = useLibraryId();
    const vendorFilters = useVendorFilters();

    // Shown signed out too, where the panel says what signing in would add.
    const favorites: Section = {
        value: "favorites",
        name: "Favorites",
        icon: <FavoriteIcon size={IconSize.MEDIUM} />,
        panel: <FavoritesList />,
        opened: uiState.isFavoritesOpen,
        setOpened: (opened) => updateUiState({ isFavoritesOpen: opened })
    };

    const search: Section = {
        value: "search",
        name: "Search Results",
        icon: (
            <MagnifyingGlassIcon
                size={IconSize.MEDIUM}
                color={PrimaryColor.FILLED}
            />
        ),
        panel: (
            <SearchResults
                query={uiState.searchQuery ?? ""}
                filters={{ vendors: vendorFilters }}
                source={InsertSource.SEARCH}
            />
        ),
        opened: isSearchOpen,
        setOpened: setIsSearchOpen
    };

    const library: Section = {
        value: "library",
        name: getLibraryName(libraryId),
        icon: <BooksIcon size={IconSize.MEDIUM} color={PrimaryColor.FILLED} />,
        title: <LibraryTitle libraryId={libraryId} />,
        panel: <LibraryList />,
        opened: uiState.isLibraryOpen,
        setOpened: (opened) => updateUiState({ isLibraryOpen: opened })
    };

    // One slot below favorites, showing search results while a query is active
    // and the library otherwise. The differing `value` remounts it on the swap.
    return [favorites, uiState.searchQuery ? search : library];
}

interface SectionAccordionProps {
    sections: Section[];
}

/** Stacks the sections, each opening and closing on its own. */
function SectionAccordion(props: SectionAccordionProps): ReactNode {
    const { sections } = props;
    const handleChange = (opened: string[]) => {
        for (const section of sections) {
            section.setOpened(opened.includes(section.value));
        }
    };

    return (
        <AppSections
            opened={sections
                .filter((section) => section.opened)
                .map((section) => section.value)}
            onChange={handleChange}
        >
            {sections.map((section) => (
                <AppSection
                    key={section.value}
                    value={section.value}
                    name={section.name}
                    title={section.title}
                    icon={section.icon}
                    opened={section.opened}
                    onToggle={() => section.setOpened(!section.opened)}
                >
                    {section.panel}
                </AppSection>
            ))}
        </AppSections>
    );
}

function HomeList(): ReactNode {
    const sections = useHomeSections();
    return (
        <>
            <SectionAccordion sections={sections} />
            <Outlet />
        </>
    );
}

/** The library's name, and a badge when it is not simply supported. */
interface LibraryTitleProps {
    libraryId: string;
}

function LibraryTitle(props: LibraryTitleProps): ReactNode {
    const { libraryId } = props;
    const status = getLibraryStatus(libraryId);
    return (
        <AppTitle
            title={getLibraryName(libraryId)}
            rightSection={
                status && (
                    <Badge size="sm" variant="light">
                        {status}
                    </Badge>
                )
            }
        />
    );
}

function LibraryList() {
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isPending) {
        return <SectionLoading title="Loading groups..." />;
    } else if (libraryQuery.isError) {
        return <SectionNotice title="Failed to load groups." />;
    }

    const groups = libraryQuery.data.groups;
    const groupOrder = libraryQuery.data.groupOrder;

    if (groupOrder.length <= 0) {
        return (
            <SectionNotice
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
