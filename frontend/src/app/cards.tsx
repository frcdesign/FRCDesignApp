import {
    Icon,
    Card,
    EntityTitle,
    Classes,
    Text,
    Alert,
    Intent,
    NonIdealState,
    NonIdealStateIconSize
} from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useEffect, useState } from "react";
import {
    DocumentObj,
    DocumentResult,
    ElementObj,
    ElementType
} from "../api/backend-types";
import { CardThumbnail } from "./thumbnail";
import { FavoriteButton } from "./favorite";
import { AppDialog } from "../api/search-params";
import { useQuery } from "@tanstack/react-query";
import { getDocumentLoader, getFavoritesLoader } from "../queries";
import { useOnshapeData } from "../api/onshape-data";
import {
    buildSearchDb,
    getCachedSearchDb,
    getSearchHitTitle,
    SearchFilters,
    SearchHit,
    setCachedSearchDb,
    doSearch
} from "../api/search";
import { AnyOrama } from "@orama/orama";

interface DocumentCardProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card representing a single document.
 */
export function DocumentCard(props: DocumentCardProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

    const thumbnail = <CardThumbnail path={document} />;

    return (
        <Card
            interactive
            onClick={() => {
                navigate({
                    to: "/app/documents/$documentId",
                    params: { documentId: document.id }
                });
            }}
            className="item-card"
        >
            <EntityTitle
                title={<Text>{document.name}</Text>}
                icon={thumbnail}
            />
            <Icon icon="arrow-right" className={Classes.TEXT_MUTED} />
        </Card>
    );
}
interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
    searchHit?: SearchHit;
}

/**
 * A card representing a part studio or assembly.
 */
export function ElementCard(props: ElementCardProps): ReactNode {
    const { element, searchHit } = props;
    const navigate = useNavigate();
    const onshapeData = useOnshapeData();
    const data = useQuery(getDocumentLoader()).data;
    const favorites = useQuery(getFavoritesLoader(onshapeData)).data;

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    if (!data || !favorites) {
        return null;
    }

    const isAssemblyInPartStudio =
        element.elementType === ElementType.ASSEMBLY &&
        onshapeData.elementType == ElementType.PART_STUDIO;

    const isFavorite = favorites[element.elementId] !== undefined;

    const thumbnail = <CardThumbnail path={element} />;

    const favoriteButton = (
        <FavoriteButton isFavorite={isFavorite} element={element} />
    );

    const alert = (
        <Alert
            isOpen={isAlertOpen}
            canEscapeKeyCancel
            canOutsideClickCancel
            onClose={(_, event) => {
                event?.stopPropagation();
                setIsAlertOpen(false);
            }}
            confirmButtonText="Close"
            icon="cross"
            intent={Intent.DANGER}
        >
            This part is an assembly and cannot be derived into a part studio.
        </Alert>
    );

    let title;
    if (searchHit) {
        title = getSearchHitTitle(searchHit);
    } else {
        title = <Text>{element.name}</Text>;
    }

    return (
        <Card
            interactive
            onClick={(event) => {
                event.stopPropagation();
                if (isAssemblyInPartStudio) {
                    setIsAlertOpen(true);
                } else {
                    navigate({
                        to: ".",
                        search: {
                            activeDialog: AppDialog.INSERT_MENU,
                            activeElementId: element.elementId
                        }
                    });
                }
            }}
            className="item-card"
        >
            <EntityTitle
                className={
                    isAssemblyInPartStudio ? Classes.TEXT_MUTED : undefined
                }
                title={title}
                icon={thumbnail}
            />
            {favoriteButton}
            {alert}
        </Card>
    );
}

interface SearchResultsProps extends SearchFilters {
    data: DocumentResult;
    query: string;
}

export function SearchResults(props: SearchResultsProps): ReactNode {
    const { data, query, documentId, vendors } = props;

    const [searchDb, setSearchDb] = useState<AnyOrama | undefined>(
        getCachedSearchDb()
    );
    const [searchHits, setSearchHits] = useState<SearchHit[] | undefined>(
        undefined
    );

    useEffect(() => {
        if (getCachedSearchDb()) {
            setSearchDb(getCachedSearchDb());
        } else {
            const searchDb = buildSearchDb(data);
            setCachedSearchDb(searchDb);
            setSearchDb(searchDb);
        }
    }, [data]);

    useEffect(() => {
        const search = async () => {
            if (!searchDb) {
                return;
            }
            setSearchHits(
                await doSearch(searchDb, query, { documentId, vendors })
            );
        };

        search();
    }, [searchDb, query, documentId, vendors]);

    if (!searchDb || !searchHits) {
        return null;
    }

    let content = null;
    if (searchHits.length === 0) {
        content = (
            <div style={{ height: "150px" }}>
                <NonIdealState
                    icon={
                        <Icon
                            icon="search"
                            size={NonIdealStateIconSize.STANDARD}
                            intent={Intent.DANGER}
                        />
                    }
                    title="No search results"
                />
            </div>
        );
    } else {
        content = searchHits.map((searchHit: SearchHit) => {
            const elementId = searchHit.id;
            const element = data.elements[elementId];
            return (
                <ElementCard
                    key={elementId}
                    element={element}
                    searchHit={searchHit}
                />
            );
        });
    }

    return content;
}
