import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Accordion, Badge, Group } from "@mantine/core";
import { Books, MagnifyingGlass } from "@phosphor-icons/react";
import {
    BORDER,
    IconSize,
    PrimaryColor
} from "../../../../lib/style-constants";
import { ReactNode, useState } from "react";
import { GroupCard } from "../../../../features/library/components/group-card";
import { ItemTable } from "../../../../features/library/components/card-components";
import { HeartIcon } from "../../../../features/favorites/components/favorite-button";
import { SearchResults } from "../../../../features/search/components/search-results";
import {
    SectionError,
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
} from "../../../../features/library/library-path";
import { updateUiState, useUiState } from "../../../../lib/ui-state";
import { useIsSignedIn } from "../../../../features/auth/access-level";

export const Route = createFileRoute("/app/library/$libraryId/")({
    component: HomeList,
    onEnter: () => {
        updateUiState({ openGroupId: undefined });
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

function HomeList(): ReactNode {
    const [uiState, setUiState] = useUiState();
    // Not persisted: search results open on every visit, unlike the library.
    const [isSearchOpen, setIsSearchOpen] = useState(true);
    const libraryId = useLibraryId();
    const isSignedIn = useIsSignedIn();

    const sections: Section[] = [];

    // Favorites are per-user and hidden until signed in.
    if (isSignedIn) {
        sections.push({
            value: "favorites",
            icon: <HeartIcon />,
            title: "Favorites",
            panel: <FavoritesList />,
            opened: uiState.isFavoritesOpen,
            setOpened: (opened) => setUiState({ isFavoritesOpen: opened })
        });
    }

    // One slot below favorites, showing search results while a query is active
    // and the library otherwise. The differing `value` remounts it on the swap.
    sections.push(
        uiState.searchQuery
            ? {
                  value: "search",
                  icon: (
                      <MagnifyingGlass
                          size={IconSize.MEDIUM}
                          color={PrimaryColor.FILLED}
                      />
                  ),
                  title: "Search Results",
                  panel: (
                      <SearchResults
                          query={uiState.searchQuery}
                          filters={{ vendors: uiState.vendorFilters }}
                      />
                  ),
                  opened: isSearchOpen,
                  setOpened: setIsSearchOpen
              }
            : {
                  value: "library",
                  icon: (
                      <Books
                          size={IconSize.MEDIUM}
                          color={PrimaryColor.FILLED}
                      />
                  ),
                  title: <LibraryTitle libraryId={libraryId} />,
                  panel: <LibraryList />,
                  opened: uiState.isLibraryOpen,
                  setOpened: (opened) => setUiState({ isLibraryOpen: opened })
              }
    );

    const handleChange = (opened: string[]) => {
        for (const section of sections) {
            section.setOpened(opened.includes(section.value));
        }
    };

    return (
        <>
            <Accordion
                multiple
                variant="unstyled"
                value={sections
                    .filter((section) => section.opened)
                    .map((section) => section.value)}
                onChange={handleChange}
                styles={{
                    // On the control, so a collapsed section still divides from
                    // the next one; content closes off an open one.
                    control: { borderBottom: BORDER },
                    content: { padding: 0, borderBottom: BORDER }
                }}
            >
                {sections.map((section) => (
                    <Accordion.Item key={section.value} value={section.value}>
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
            <Outlet />
        </>
    );
}

/** The library's name, and a badge when it is not simply supported. */
function LibraryTitle({ libraryId }: { libraryId: string }): ReactNode {
    const status = getLibraryStatus(libraryId);
    return (
        <Group gap="xs" wrap="nowrap">
            {getLibraryName(libraryId)}
            {status && (
                <Badge size="sm" variant="light" color={status.color}>
                    {status.label}
                </Badge>
            )}
        </Group>
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
