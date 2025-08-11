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
    NonIdealStateIconSize
} from "@blueprintjs/core";
import { Outlet, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentCard, ElementCard } from "./cards";
import { FavoriteIcon } from "./favorite";
import { getDocumentLoader, getFavoritesLoader } from "../queries";
import { useQuery } from "@tanstack/react-query";
import { DocumentResult } from "../api/backend-types";
import { SearchResults } from "./search-results";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const data = useQuery(getDocumentLoader()).data;
    const search = useSearch({ from: "/app" });

    if (!data) {
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
                    data={data}
                    query={search.query}
                    filters={{
                        vendors: search.vendors,
                        documentId: search.documentId
                    }}
                />
            </ListContainer>
        );
    } else {
        const libraryContent = Object.entries(data.documents).map(
            ([documentId, document]) => {
                return <DocumentCard key={documentId} document={document} />;
            }
        );

        content = (
            <>
                <ListContainer
                    icon={<FavoriteIcon />}
                    title="Favorites"
                    defaultIsOpen={false}
                >
                    <FavoritesList data={data} />
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
    data: DocumentResult;
}

function FavoritesList(props: FavoritesListProps) {
    const { data } = props;

    const onshapeData = useSearch({ from: "/app" });
    const favorites = useQuery(getFavoritesLoader(onshapeData)).data;

    if (!favorites) {
        return null;
    }

    if (Object.keys(favorites).length == 0) {
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

    return Object.keys(favorites).map((id: string) => {
        // Have to guard against elements in case we ever deprecate a document
        const element = data.elements[id];
        if (!element) {
            return null;
        }
        return <ElementCard key={id} element={element} />;
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
