import {
    Card,
    Collapse,
    Group,
    Stack,
    Text,
    UnstyledButton
} from "@mantine/core";
import {
    IconBook,
    IconChevronDown,
    IconChevronUp,
    IconSearch
} from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { Outlet } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentCard } from "../cards/document-card";
import { HeartIcon } from "../favorites/favorite-button";
import { SearchResults } from "../search/search-results";
import { useUiState } from "../api-utils/ui-state";
import { SectionError, SectionLoading } from "../common/app-zero-state";
import { RequireAccessLevel } from "../api-utils/access-level";
import { AddDocumentButton } from "./add-document-menu";
import { FavoritesList } from "../favorites/favorites-list";
import { useLibraryQuery } from "../queries";
import { getLibraryName } from "../api-utils/library";
import { useLibrary } from "../api-utils/library";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const [uiState, setUiState] = useUiState();
    const [isSearchOpen, setIsSearchOpen] = useState(true);
    const library = useLibrary();

    const favoritesList = (
        <ListContainer
            icon={<HeartIcon />}
            title="Favorites"
            isOpen={uiState.isFavoritesOpen}
            onClick={(isOpen) => setUiState({ isFavoritesOpen: isOpen })}
        >
            <FavoritesList />
        </ListContainer>
    );

    let documentList;
    if (uiState.searchQuery) {
        // Key is needed to differentiate between Favorites
        // Otherwise the useState in ListContainer can get confused
        documentList = (
            <ListContainer
                key="search"
                icon={
                    <IconSearch
                        size={IconSize.MEDIUM}
                        color="var(--mantine-primary-color-filled)"
                    />
                }
                title="Search Results"
                isOpen={isSearchOpen}
                onClick={setIsSearchOpen}
            >
                <SearchResults
                    query={uiState.searchQuery}
                    filters={{ vendors: uiState.vendorFilters }}
                />
            </ListContainer>
        );
    } else {
        documentList = (
            <ListContainer
                icon={
                    <IconBook
                        size={IconSize.MEDIUM}
                        color="var(--mantine-primary-color-filled)"
                    />
                }
                title={getLibraryName(library)}
                isOpen={uiState.isLibraryOpen}
                onClick={(isOpen) => setUiState({ isLibraryOpen: isOpen })}
            >
                <LibraryList />
            </ListContainer>
        );
    }

    return (
        <>
            {favoritesList}
            {documentList}
            <Outlet />
        </>
    );
}

function LibraryList() {
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isError) {
        return <SectionError title="Failed to load documents." />;
    } else if (libraryQuery.isPending) {
        return <SectionLoading title="Loading documents..." />;
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

    return documentOrder.map((documentId) => {
        const document = documents[documentId];
        if (!document) {
            return null;
        }
        return <DocumentCard key={document.id} document={document} />;
    });
}

interface ListContainerProps extends PropsWithChildren {
    isOpen: boolean;
    onClick?: (isOpen: boolean) => void;
    icon: ReactNode;
    title: string;
}

function ListContainer(props: ListContainerProps): ReactNode {
    const { icon, title, children, isOpen, onClick } = props;

    return (
        <Card withBorder radius="md" padding={0} mb="sm">
            <UnstyledButton
                onClick={() => onClick && onClick(!isOpen)}
                w="100%"
            >
                <Group justify="space-between" px="sm" py="xs" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                        {icon}
                        <Text fw={600}>{title}</Text>
                    </Group>
                    {isOpen ? (
                        <IconChevronUp
                            size={IconSize.SMALL}
                            color="var(--mantine-color-dimmed)"
                        />
                    ) : (
                        <IconChevronDown
                            size={IconSize.SMALL}
                            color="var(--mantine-color-dimmed)"
                        />
                    )}
                </Group>
            </UnstyledButton>
            <Collapse expanded={isOpen}>
                <Stack gap={0}>{children}</Stack>
            </Collapse>
        </Card>
    );
}
