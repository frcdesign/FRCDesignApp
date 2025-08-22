import {
    Button,
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
import { Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentCard, ElementCard } from "./cards";
import { FavoriteIcon } from "./favorite";
import {
    useDocumentOrderQuery,
    useDocumentsQuery,
    useElementsQuery,
    useFavoritesQuery
} from "../queries";
import { hasMemberAccess } from "../api/backend-types";
import { SearchResults } from "./search-results";
import { getElementOrder, useSearchDb } from "../api/search";
import { AppMenu } from "../api/menu-params";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const search = useSearch({ from: "/app" });

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
                    query={search.query}
                    filters={{ vendors: search.vendors }}
                />
            </ListContainer>
        );
    } else {
        content = (
            <>
                <ListContainer
                    icon={<FavoriteIcon />}
                    title="Favorites"
                    defaultIsOpen={false}
                >
                    <FavoritesList />
                </ListContainer>
                <ListContainer
                    icon={<Icon icon="manual" className="frc-design-green" />}
                    title="Library"
                >
                    <LibraryList />
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

function LibraryList() {
    const search = useSearch({ from: "/app" });
    const navigate = useNavigate();

    const documentsQuery = useDocumentsQuery();
    const documentOrderQuery = useDocumentOrderQuery();

    if (documentsQuery.isPending || documentOrderQuery.isPending) {
        return (
            <NonIdealState
                icon={<Spinner intent="primary" />}
                title="Loading documents..."
                className="home-loading-state"
            />
        );
    } else if (documentsQuery.isError || documentOrderQuery.isError) {
        // Add an escape hatch for when no documents are in the database
        const action = hasMemberAccess(search.maxAccessLevel) ? (
            <Button
                icon="add"
                text="Add document"
                intent="primary"
                onClick={() => {
                    navigate({
                        to: ".",
                        search: { activeMenu: AppMenu.ADD_DOCUMENT_MENU }
                    });
                }}
            />
        ) : undefined;

        return (
            <NonIdealState
                icon={
                    <Icon
                        icon="cross"
                        size={NonIdealStateIconSize.SMALL}
                        intent="danger"
                        style={{ marginBottom: "-5px" }}
                    />
                }
                title="Failed to load documents!"
                description="If the problem persists, contact the FRCDesign App developers."
                action={action}
                className="home-error-state"
            />
        );
    }

    const documents = documentsQuery.data;
    const documentOrder = documentOrderQuery.data;

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

    const elementsQuery = useElementsQuery();
    const favoritesQuery = useFavoritesQuery(search);

    const searchDb = useSearchDb(elementsQuery.data);

    if (favoritesQuery.isPending || elementsQuery.isPending || !searchDb) {
        return (
            <NonIdealState
                icon={<Spinner intent="primary" />}
                title="Loading favorites..."
                className="home-loading-state"
            />
        );
    } else if (favoritesQuery.isError || elementsQuery.isError) {
        return (
            <NonIdealState
                icon={
                    <Icon
                        icon="heart-broken"
                        size={NonIdealStateIconSize.SMALL}
                        color={Colors.RED3}
                    />
                }
                title="Failed to load favorites!"
                description="If the problem persists, contact the FRCDesign App developers."
                className="home-error-state"
            />
        );
    }

    const favorites = favoritesQuery.data;
    const elements = elementsQuery.data;

    const orderedFavorites = getElementOrder(searchDb, {
        elementIds: Object.keys(favorites),
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
