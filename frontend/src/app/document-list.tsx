import {
    CardList,
    ContextMenuChildrenProps,
    Section,
    SectionCard
} from "@blueprintjs/core";
import {
    Outlet,
    useNavigate,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { ReactNode, useRef } from "react";
import { SearchResults } from "../search/search-results";
import { DocumentObj, Elements, hasMemberAccess } from "../api/models";
import { useUiState } from "../api/ui-state";
import { filterElements, SortOrder } from "../search/filter";
import { DocumentContextMenu } from "../cards/document-card";
import { ElementCard } from "../cards/element-card";
import { ContextMenuButton } from "../cards/card-components";
import { FilterCallout } from "../navbar/filter-callout";
import {
    AppErrorState,
    AppInternalErrorState,
    AppLoadingState
} from "../common/app-zero-state";
import { ClearFiltersButton } from "../navbar/vendor-filters";
import { useInteractiveSection } from "../common/utils";
import { useLibraryQuery } from "../queries";

/**
 * A list of elements in a document.
 */
export function DocumentList(): ReactNode {
    const navigate = useNavigate();
    const libraryQuery = useLibraryQuery();
    const documentId = useParams({
        from: "/app/documents/$documentId"
    }).documentId;

    const uiState = useUiState()[0];

    // Manually inject the interactive class into the section
    const sectionRef = useRef<HTMLDivElement>(null);

    // Include documents and elements as dependencies so it stays interactive even if the query isn't complete
    useInteractiveSection(sectionRef, [libraryQuery]);

    if (libraryQuery.isPending) {
        return <AppLoadingState title="Loading documents..." />;
    } else if (libraryQuery.isError) {
        return <AppInternalErrorState title="Failed to load document." />;
    }
    const documents = libraryQuery.data.documents;
    const elements = libraryQuery.data.elements;

    const document = documents[documentId];

    if (!document) {
        return null;
    }

    let content;
    if (uiState.searchQuery) {
        content = (
            <CardList bordered={false} compact>
                <SearchResults
                    query={uiState.searchQuery}
                    filters={{
                        vendors: uiState.vendorFilters,
                        documentId: document.documentId
                    }}
                />
            </CardList>
        );
    } else {
        content = (
            <DocumentListContent document={document} elements={elements} />
        );
    }

    return (
        <>
            <DocumentContextMenu document={document}>
                {(ctxMenuProps: ContextMenuChildrenProps) => (
                    <>
                        <Section
                            icon="arrow-left"
                            onContextMenu={ctxMenuProps.onContextMenu}
                            ref={sectionRef}
                            title={document.name}
                            onClick={() => {
                                navigate({ to: "/app/documents" });
                            }}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flexGrow: 0,
                                maxHeight: "100%"
                            }}
                            rightElement={
                                <ContextMenuButton
                                    onClick={ctxMenuProps.onContextMenu}
                                />
                            }
                        >
                            <SectionCard
                                // Stop propagation in the card so clicks around the edge/inside child cards don't close the section
                                onClick={(event) => event.stopPropagation()}
                                padded={false}
                                style={{ overflowY: "auto" }}
                            >
                                {content}
                            </SectionCard>
                        </Section>
                        {ctxMenuProps.popover}
                    </>
                )}
            </DocumentContextMenu>
            <Outlet />
        </>
    );
}

interface DocumentListCardsProps {
    document: DocumentObj;
    elements: Elements;
}

export function DocumentListContent(props: DocumentListCardsProps): ReactNode {
    const { document, elements } = props;

    const search = useSearch({ from: "/app" });
    const uiState = useUiState()[0];

    const documentSortOrder = document.sortAlphabetically
        ? SortOrder.ASCENDING
        : SortOrder.DEFAULT;

    const documentElements = document.elementOrder
        .map((elementOrder) => elements[elementOrder])
        .filter((element) => !!element);

    if (documentElements.length === 0) {
        return (
            <AppInternalErrorState title="This document has no visible elements." />
        );
    }

    const filterResult = filterElements(documentElements, {
        sortOrder: documentSortOrder,
        vendors: uiState.vendorFilters,
        // Only show visible elements to users
        isVisible: !hasMemberAccess(search.currentAccessLevel)
    });

    if (filterResult.elements.length === 0) {
        return (
            <AppErrorState
                icon="warning-sign"
                iconIntent="warning"
                title="All elements are hidden by filters"
                action={<ClearFiltersButton standardSize />}
            />
        );
    }

    let callout = null;
    if (filterResult.filteredByVendors > 0) {
        callout = (
            <FilterCallout
                itemName="elements"
                filteredItems={filterResult.filteredByVendors}
            />
        );
    }

    const elementCards = filterResult.elements.map((element) => (
        <ElementCard key={element.id} element={element} />
    ));

    return (
        <>
            {callout}
            <CardList bordered={false} compact>
                {elementCards}
            </CardList>
        </>
    );
}
