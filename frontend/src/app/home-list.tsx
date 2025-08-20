import {
    Card,
    CardList,
    Classes,
    Collapse,
    Colors,
    H6,
    Icon,
    Intent,
    NonIdealState,
    NonIdealStateIconSize,
    Spinner
} from "@blueprintjs/core";
import { Outlet, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentCard, ElementCard } from "./cards";
import { FavoriteIcon } from "./favorite";
import {
    useDocumentsQuery,
    useElementsQuery,
    useFavoritesQuery
} from "../queries";
import {
    DocumentsResult,
    ElementsResult,
    hasMemberAccess
} from "../api/backend-types";
import { SearchResults } from "./search-results";
import { getElementOrder, useSearchDb } from "../api/search";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const documents = useDocumentsQuery().data;
    const elements = useElementsQuery().data;
    const search = useSearch({ from: "/app" });

    if (!documents || !elements) {
        return null;
    }

    let content;
    if (search.query) {
        // Key is needed to differentiate between Favorites
        // Otherwise the useState in ListContainer can get confused
        content = (
            <ListContainer
                key="search"
                icon={<Icon icon="search" intent={Intent.PRIMARY} />}
                title="Search Results"
            >
                <SearchResults
                    documents={documents}
                    elements={elements}
                    query={search.query}
                    filters={{
                        vendors: search.vendors,
                        documentId: search.documentId
                    }}
                />
            </ListContainer>
        );
    } else {
        const libraryContent = Object.values(documents).map((document) => {
            return <DocumentCard key={document.id} document={document} />;
        });

        content = (
            <>
                <ListContainer
                    icon={<FavoriteIcon />}
                    title="Favorites"
                    defaultIsOpen={false}
                >
                    <FavoritesList documents={documents} elements={elements} />
                </ListContainer>
                <ListContainer
                    icon={<Icon icon="manual" className="frc-design-green" />}
                    title="Library"
                >
                    {libraryContent}
                </ListContainer>
            </>
        );
    }

    return (
        <>
            <div style={{ overflow: "scroll" }}>
                <CardList compact style={{ margin: "0px" }} bordered={false}>
                    {content}
                </CardList>
            </div>
            <Outlet />
        </>
    );
}

interface FavoritesListProps {
    documents: DocumentsResult;
    elements: ElementsResult;
}

function FavoritesList(props: FavoritesListProps) {
    const { documents, elements } = props;

    const search = useSearch({ from: "/app" });
    const favoritesQuery = useFavoritesQuery(search);

    const searchDb = useSearchDb(documents, elements);

    if (favoritesQuery.isPending || !searchDb) {
        return (
            <NonIdealState
                icon={<Spinner intent="primary" />}
                title="Loading..."
            />
        );
    } else if (favoritesQuery.isError) {
        return (
            <NonIdealState
                icon={
                    <Icon
                        icon="heart-broken"
                        size={NonIdealStateIconSize.SMALL}
                        color={Colors.RED3}
                        style={{ marginBottom: "-5px" }}
                    />
                }
                title="Failed to load favorites"
            />
        );
    }

    const orderedFavorites = getElementOrder(searchDb, {
        elementIds: Object.keys(favoritesQuery.data),
        vendors: search.vendors,
        // Only show visible elements
        isVisible: !hasMemberAccess(search.accessLevel)
    });

    if (orderedFavorites.length == 0) {
        return (
            <NonIdealState
                icon={
                    <Icon
                        icon="heart-broken"
                        size={NonIdealStateIconSize.SMALL}
                        color={Colors.RED3}
                        style={{ marginBottom: "-5px" }}
                    />
                }
                title="No favorites"
                className="home-error-state"
            />
        );
    }

    return orderedFavorites.map((elementId: string) => {
        // Have to guard against elements in case we ever deprecate a document
        const element = elements[elementId];
        if (!element) {
            return null;
        }
        return <ElementCard key={elementId} element={element} />;
    });
}

interface ListContainerProps extends PropsWithChildren {
    /**
     * Whether the section is open by default.
     * @default true
     */
    defaultIsOpen?: boolean;
    icon: ReactNode;
    title: string;
}

function ListContainer(props: ListContainerProps): ReactNode {
    const { icon, title, children } = props;
    const [isOpen, setIsOpen] = useState(props.defaultIsOpen ?? true);
    return (
        <>
            <Card
                className="split"
                onClick={() => setIsOpen(!isOpen)}
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
            </Collapse>
        </>
    );
}
