import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Accordion } from "@mantine/core";
import { IconBook, IconSearch } from "@tabler/icons-react";
import { BORDER, IconSize } from "../../../common/style-constants";
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

function HomeList(): ReactNode {
    const [uiState, setUiState] = useUiState();
    const [isSearchOpen, setIsSearchOpen] = useState(true);
    const library = useLibrary();

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

    const favoritesAccordian = (
        <Accordion.Item value="favorites">
            <Accordion.Control icon={<HeartIcon />}>
                Favorites
            </Accordion.Control>
            <Accordion.Panel>
                <FavoritesList />
            </Accordion.Panel>
        </Accordion.Item>
    );

    let childAccordian: ReactNode;
    if (isSearch) {
        childAccordian = (
            <Accordion.Item key={listKey} value={listKey}>
                <Accordion.Control
                    icon={
                        <IconSearch
                            size={IconSize.MEDIUM}
                            color="var(--mantine-primary-color-filled)"
                        />
                    }
                >
                    Search Results
                </Accordion.Control>
                <Accordion.Panel>
                    <SearchResults
                        query={uiState.searchQuery!}
                        filters={{ vendors: uiState.vendorFilters }}
                    />
                </Accordion.Panel>
            </Accordion.Item>
        );
    } else {
        childAccordian = (
            <Accordion.Item key={listKey} value={listKey}>
                <Accordion.Control
                    icon={
                        <IconBook
                            size={IconSize.MEDIUM}
                            color="var(--mantine-primary-color-filled)"
                        />
                    }
                >
                    {getLibraryName(library)}
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
                {favoritesAccordian}
                {childAccordian}
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
