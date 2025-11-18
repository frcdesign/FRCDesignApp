import {
    CardList,
    Classes,
    Collapse,
    Icon,
    Intent,
    MaybeElement,
    Section,
    SectionCard
} from "@blueprintjs/core";
import { Outlet } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useRef, useState } from "react";
import { DocumentCard } from "../cards/document-card";
import { HeartIcon } from "../favorites/favorite-button";
import { SearchResults } from "../search/search-results";
import { useUiState } from "../api/ui-state";
import {
    AppErrorState,
    AppInternalErrorState,
    AppLoadingState
} from "../common/app-zero-state";
import { RequireAccessLevel } from "../api/access-level";
import { useInteractiveSection } from "../common/utils";
import { AddDocumentButton } from "./add-document-menu";
import { FavoritesList } from "../favorites/favorites-list";
import { useLibraryQuery } from "../queries";
import { getLibraryName } from "../api/library";
import { useLibrary } from "../api/library";

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
                icon={<Icon icon="search" intent={Intent.PRIMARY} />}
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
                icon={<Icon icon="manual" className="frc-design-green" />}
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
            {/* <CardList compact style={{ margin: "0px" }} bordered={false}> */}
            {favoritesList}
            {documentList}
            {/* </CardList> */}
            <Outlet />
        </>
    );
}

function LibraryList() {
    const libraryQuery = useLibraryQuery();

    if (libraryQuery.isError) {
        return (
            <AppInternalErrorState title="Failed to load documents." inline />
        );
    } else if (libraryQuery.isPending) {
        return <AppLoadingState title="Loading documents..." />;
    }

    const documents = libraryQuery.data.documents;
    const documentOrder = libraryQuery.data.documentOrder;

    if (documentOrder.length <= 0) {
        // Add an escape hatch for when no documents are in the database
        return (
            <AppErrorState
                title="No documents found"
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
    icon: MaybeElement;
    title: string;
}

function ListContainer(props: ListContainerProps): ReactNode {
    const { icon, title, children, isOpen, onClick } = props;

    const sectionRef = useRef<HTMLDivElement>(null);
    useInteractiveSection(sectionRef);

    return (
        <>
            <Section
                icon={icon}
                title={title}
                ref={sectionRef}
                onClick={() => onClick && onClick(!isOpen)}
                style={{
                    display: "flex",
                    flexDirection: "column"
                }}
                rightElement={
                    <Icon
                        icon={isOpen ? "chevron-up" : "chevron-down"}
                        className={Classes.TEXT_MUTED}
                    />
                }
            >
                <SectionCard
                    padded={false}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Collapse isOpen={isOpen}>
                        <CardList compact bordered={false}>
                            {children}
                        </CardList>
                    </Collapse>
                </SectionCard>
            </Section>
            {/* <Card
                className="split"
                onClick={() => onClick && onClick(!isOpen)}
                interactive
            >
                <div className="home-card-title">
                    {icon}
                    <H6 style={{ marginBottom: "1px" }}>{title}</H6>
                </div>
                <Icon
                    icon={isOpen ? "chevron-up" : "chevron-down"}
                    className={Classes.TEXT_MUTED}
                />
            </Card>
            <Collapse isOpen={isOpen}>
                <CardList compact>{children}</CardList>
            </Collapse> */}
        </>
    );
}
