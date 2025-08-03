import {
    Icon,
    Card,
    EntityTitle,
    Classes,
    Text,
    Alert,
    Intent,
    NonIdealState,
    NonIdealStateIconSize,
    Menu,
    MenuItem,
    ContextMenu,
    ContextMenuChildrenProps,
    Tag
} from "@blueprintjs/core";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useEffect, useState } from "react";
import {
    AccessLevel,
    DocumentObj,
    DocumentResult,
    ElementObj,
    ElementType,
    hasMemberAccess
} from "../api/backend-types";
import { CardThumbnail } from "./thumbnail";
import { FavoriteButton } from "./favorite";
import { AppDialog } from "../api/search-params";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getDocumentLoader, getFavoritesLoader } from "../queries";
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
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";

interface DocumentCardProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card representing a single document.
 */
export function DocumentCard(props: DocumentCardProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

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
                icon={<CardThumbnail path={document} />}
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
    const pathname = useLocation().pathname;
    const search = useSearch({ from: "/app" });
    const data = useQuery(getDocumentLoader()).data;
    const favorites = useQuery(getFavoritesLoader(search)).data;

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    if (
        !data ||
        !favorites ||
        (search.accessLevel === AccessLevel.USER && !element.isVisible)
    ) {
        return null;
    }

    const isAssemblyInPartStudio =
        element.elementType === ElementType.ASSEMBLY &&
        search.elementType == ElementType.PART_STUDIO;

    const isFavorite = favorites[element.elementId] !== undefined;

    const alert = (
        <Alert
            isOpen={isAlertOpen}
            canEscapeKeyCancel
            canOutsideClickCancel
            onClose={() => {
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
        title = element.name;
    }

    let hiddenTag = null;
    if (hasMemberAccess(search.accessLevel) && !element.isVisible) {
        hiddenTag = (
            <Tag round intent="warning" icon="eye-off" title="Hidden" />
        );
    }

    return (
        <ElementContextMenu element={element}>
            {(ctxMenuProps: ContextMenuChildrenProps) => (
                <Card
                    className="item-card"
                    onContextMenu={ctxMenuProps.onContextMenu}
                    ref={ctxMenuProps.ref}
                    interactive
                    onClick={(event) => {
                        // Add special handling here so context menu clicks don't bubble through
                        if (event.target !== event.currentTarget) {
                            return;
                        }
                        if (isAssemblyInPartStudio) {
                            setIsAlertOpen(true);
                            return;
                        }

                        navigate({
                            to: pathname,
                            search: {
                                activeDialog: AppDialog.INSERT_MENU,
                                activeElementId: element.elementId
                            }
                        });
                    }}
                >
                    {ctxMenuProps.popover}
                    <EntityTitle
                        className={
                            isAssemblyInPartStudio
                                ? Classes.TEXT_MUTED
                                : undefined
                        }
                        ellipsize
                        title={title}
                        icon={<CardThumbnail path={element} />}
                        tags={hiddenTag}
                    />
                    <FavoriteButton isFavorite={isFavorite} element={element} />
                    {alert}
                </Card>
            )}
        </ElementContextMenu>
    );
}

interface ElementContextMenuProps {
    element: ElementObj;
    children: any;
}

function ElementContextMenu(props: ElementContextMenuProps) {
    const { children, element } = props;

    const mutation = useMutation({
        mutationKey: ["set-visibility"],
        mutationFn: () => {
            return apiPost("/set-visibility", {
                body: {
                    elementId: element.id,
                    isVisible: !element.isVisible
                }
            });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ["documents"] });
        }
    });

    const menu = (
        <Menu>
            <MenuItem
                shouldDismissPopover
                onClick={() => {
                    mutation.mutate();
                }}
                intent={element.isVisible ? "danger" : "primary"}
                icon={element.isVisible ? "eye-off" : "eye-open"}
                text={element.isVisible ? "Hide element" : "Show element"}
            />
        </Menu>
    );

    return <ContextMenu content={menu}>{children}</ContextMenu>;
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
