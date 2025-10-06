import {
    Button,
    Card,
    CardList,
    Classes,
    Collapse,
    Colors,
    Icon,
    Intent,
    MaybeElement,
    Section,
    SectionCard
} from "@blueprintjs/core";
import { Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useRef } from "react";
import { DocumentCard } from "../cards/document-card";
import { HeartIcon } from "../favorites/favorite-button";
import {
    useDocumentOrderQuery,
    useDocumentsQuery,
    useElementsQuery,
    useUserData
} from "../queries";
import { ElementObj, hasMemberAccess } from "../api/models";
import { SearchResults } from "../search/search-results";
import { AppMenu } from "../api/menu-params";
import { useUiState } from "../api/ui-state";
import { filterElements } from "../api/filter";
import { FavoriteCard } from "../favorites/favorite-card";
import { FilterCallout } from "../navbar/filter-callout";
import {
    AppErrorState,
    AppInternalErrorState,
    AppLoadingState
} from "../common/app-zero-state";
import { RequireAccessLevel } from "../api/access-level";
import { ClearFiltersButton } from "../navbar/vendor-filters";
import { useInteractiveSection } from "../common/utils";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const [uiState, setUiState] = useUiState();

    let content;
    if (uiState.searchQuery) {
        // Key is needed to differentiate between Favorites
        // Otherwise the useState in ListContainer can get confused
        content = (
            <ListContainer
                key="search"
                icon={<Icon icon="search" intent={Intent.PRIMARY} />}
                title="Search Results"
                isOpen
            >
                <SearchResults
                    query={uiState.searchQuery}
                    filters={{ vendors: uiState.vendorFilters }}
                />
            </ListContainer>
        );
    } else {
        content = (
            <>
                <ListContainer
                    icon={<HeartIcon />}
                    title="Favorites"
                    isOpen={uiState.isFavoritesOpen}
                    onClick={(isOpen) =>
                        setUiState({ isFavoritesOpen: isOpen })
                    }
                >
                    <FavoritesList />
                </ListContainer>
                <ListContainer
                    icon={<Icon icon="manual" className="frc-design-green" />}
                    title="Library"
                    isOpen={uiState.isLibraryOpen}
                    onClick={(isOpen) => setUiState({ isLibraryOpen: isOpen })}
                >
                    <LibraryList />
                </ListContainer>
            </>
        );
    }

    return (
        <>
            {/* <CardList compact style={{ margin: "0px" }} bordered={false}> */}
            {content}
            {/* </CardList> */}
            <Outlet />
        </>
    );
}

function LibraryList() {
    const navigate = useNavigate();

    const documentsQuery = useDocumentsQuery();
    const documentOrderQuery = useDocumentOrderQuery();

    if (documentsQuery.isError || documentOrderQuery.isError) {
        return (
            <AppInternalErrorState title="Failed to load documents." inline />
        );
    } else if (documentsQuery.isPending || documentOrderQuery.isPending) {
        return <AppLoadingState title="Loading documents..." />;
    }

    const documents = documentsQuery.data;
    const documentOrder = documentOrderQuery.data;

    if (documentOrder.length <= 0) {
        // Add an escape hatch for when no documents are in the database
        return (
            <AppErrorState
                title="No documents found"
                action={
                    <RequireAccessLevel>
                        <Button
                            icon="add"
                            text="Add document"
                            intent="primary"
                            onClick={() => {
                                navigate({
                                    to: ".",
                                    search: {
                                        activeMenu: AppMenu.ADD_DOCUMENT_MENU
                                    }
                                });
                            }}
                        />
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

function FavoritesList() {
    const search = useSearch({ from: "/app" });
    const uiState = useUiState()[0];

    const elementsQuery = useElementsQuery();
    const userData = useUserData();

    if (elementsQuery.isError) {
        return (
            <AppInternalErrorState
                title="Failed to load favorites."
                icon="heart-broken"
                iconColor={Colors.RED3}
                inline
            />
        );
    } else if (elementsQuery.isPending) {
        return <AppLoadingState title="Loading favorites..." />;
    }

    const favorites = userData.favorites;
    const elements = elementsQuery.data;

    const orderedFavorites = userData.favoriteOrder.map(
        (favoriteId) => favorites[favoriteId]
    );

    const favoriteElements = orderedFavorites.map(
        (favorite) => elements[favorite.id]
    );

    if (favoriteElements.length == 0) {
        return (
            <AppErrorState
                title="No favorites"
                icon="heart-broken"
                iconColor={Colors.RED3}
            />
        );
    }

    const filterResult = filterElements(favoriteElements, {
        vendors: uiState.vendorFilters,
        // Only show visible elements
        isVisible: !hasMemberAccess(search.currentAccessLevel)
    });

    let callout;
    if (filterResult.elements.length == 0) {
        return (
            <AppErrorState
                title="All favorites are hidden by filters"
                icon="heart-broken"
                iconColor={Colors.RED3}
                action={<ClearFiltersButton standardSize />}
            />
        );
    }

    if (filterResult.filteredByVendors > 0) {
        callout = (
            <Card className="item-card" style={{ padding: "0px" }}>
                <FilterCallout
                    itemName="favorites"
                    filteredItems={filterResult.filteredByVendors}
                />
            </Card>
        );
    }

    const cards = filterResult.elements.map((element: ElementObj) => {
        const favorite = favorites[element.id];
        return (
            <FavoriteCard
                key={favorite.id}
                element={element}
                favorite={favorite}
            />
        );
    });

    return (
        <>
            {callout}
            {cards}
        </>
    );
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
