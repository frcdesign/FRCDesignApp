import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Accordion } from "@mantine/core";
import { IconBook, IconSearch } from "@tabler/icons-react";
import { ReactNode, useState } from "react";
import { DocumentCard } from "../../../cards/document-card";
import { ItemTable } from "../../../cards/card-components";
import { HeartIcon } from "../../../favorites/favorite-button";
import { SearchResults } from "../../../search/search-results";
import { SectionError, SectionLoading } from "../../../common/app-zero-state";
import { RequireAccessLevel } from "../../../api-utils/access-level";
import { AddDocumentButton } from "../../../app/add-document-menu";
import { FavoritesList } from "../../../favorites/favorites-list";
import { useLibraryQuery } from "../../../queries";
import { getLibraryName, useLibrary } from "../../../api-utils/library";
import { updateUiState, useUiState } from "../../../api-utils/ui-state";

export const Route = createFileRoute("/app/documents/")({
    component: HomeList,
    onEnter: () => {
        updateUiState({ openDocumentId: undefined });
    }
});

const FAVORITES_VALUE = "favorites";

function HomeList(): ReactNode {
    const [uiState, setUiState] = useUiState();
    const [isSearchOpen, setIsSearchOpen] = useState(true);
    const library = useLibrary();

    const isSearch = !!uiState.searchQuery;
    // Use a distinct value (and key) for search so toggling it doesn't share
    // open state with the library section.
    const documentValue = isSearch ? "search" : "library";

    const value: string[] = [];
    if (uiState.isFavoritesOpen) {
        value.push(FAVORITES_VALUE);
    }
    if (isSearch ? isSearchOpen : uiState.isLibraryOpen) {
        value.push(documentValue);
    }

    const handleChange = (newValue: string[]) => {
        setUiState({ isFavoritesOpen: newValue.includes(FAVORITES_VALUE) });
        if (isSearch) {
            setIsSearchOpen(newValue.includes(documentValue));
        } else {
            setUiState({ isLibraryOpen: newValue.includes(documentValue) });
        }
    };

    return (
        <>
            <Accordion
                multiple
                variant="separated"
                value={value}
                onChange={handleChange}
            >
                <Accordion.Item value={FAVORITES_VALUE}>
                    <Accordion.Control icon={<HeartIcon />}>
                        Favorites
                    </Accordion.Control>
                    <Accordion.Panel>
                        <FavoritesList />
                    </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item key={documentValue} value={documentValue}>
                    <Accordion.Control
                        icon={
                            isSearch ? (
                                <IconSearch
                                    size={18}
                                    color="var(--mantine-primary-color-filled)"
                                />
                            ) : (
                                <IconBook
                                    size={18}
                                    color="var(--mantine-primary-color-filled)"
                                />
                            )
                        }
                    >
                        {isSearch ? "Search Results" : getLibraryName(library)}
                    </Accordion.Control>
                    <Accordion.Panel>
                        {isSearch ? (
                            <SearchResults
                                query={uiState.searchQuery!}
                                filters={{ vendors: uiState.vendorFilters }}
                            />
                        ) : (
                            <LibraryList />
                        )}
                    </Accordion.Panel>
                </Accordion.Item>
            </Accordion>
            <Outlet />
        </>
    );
}

function LibraryList() {
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isPending) {
        return <SectionLoading title="Loading documents..." />;
    } else if (libraryQuery.isError) {
        return <SectionError title="Failed to load documents." />;
    }

    const documents = libraryQuery.data.documents;
    const documentOrder = libraryQuery.data.documentOrder;

    if (documentOrder.length <= 0) {
        // Add an escape hatch for when no documents are in the database
        return (
            <SectionError
                title="No documents found"
                description={null}
                action={
                    <RequireAccessLevel>
                        <AddDocumentButton />
                    </RequireAccessLevel>
                }
            />
        );
    }

    return (
        <ItemTable>
            {documentOrder.map((documentId) => {
                const document = documents[documentId];
                if (!document) {
                    return null;
                }
                return <DocumentCard key={document.id} document={document} />;
            })}
        </ItemTable>
    );
}
