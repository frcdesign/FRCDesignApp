import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Accordion, Badge } from "@mantine/core";
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
import styles from "../../../../lib/styles.module.css";
import classes from "./index.module.css";

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
    icon: ReactNode;
    title: ReactNode;
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
        icon: <FavoriteIcon size={IconSize.MEDIUM} />,
        title: <AppTitle title="Favorites" />,
        panel: <FavoritesList />,
        opened: uiState.isFavoritesOpen,
        setOpened: (opened) => updateUiState({ isFavoritesOpen: opened })
    };

    const search: Section = {
        value: "search",
        icon: (
            <MagnifyingGlassIcon
                size={IconSize.MEDIUM}
                color={PrimaryColor.FILLED}
            />
        ),
        title: <AppTitle title="Search Results" />,
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
        <Accordion
            multiple
            variant="unstyled"
            value={sections
                .filter((section) => section.opened)
                .map((section) => section.value)}
            onChange={handleChange}
            // The divider is on the control, so a collapsed section still
            // divides from the next one; content closes off an open one.
            classNames={{
                control: `${classes.control} ${styles.sectionHeader} ${styles.dividerBottom}`,
                item: classes.item,
                label: classes.label,
                content: `${classes.content} ${styles.dividerBottom}`,
                icon: styles.titleIcon
            }}
        >
            {sections.map((section, index) => (
                <Accordion.Item
                    key={section.value}
                    value={section.value}
                    style={{ "--section-index": index }}
                >
                    <Accordion.Control
                        icon={section.icon}
                        className="interactive"
                    >
                        {section.title}
                    </Accordion.Control>
                    <Accordion.Panel>{section.panel}</Accordion.Panel>
                </Accordion.Item>
            ))}
        </Accordion>
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
