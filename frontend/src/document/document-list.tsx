import {
    CardList,
    Classes,
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
import { ReactNode, RefObject, useLayoutEffect, useRef } from "react";
import { ElementCard } from "./cards";
import { SearchResults } from "../app/search-results";
import { getElementOrder, SortOrder, useSearchDb } from "../api/search";
import { hasMemberAccess } from "../api/models";
import { useDocumentsQuery, useElementsQuery } from "../queries";
import { DocumentContextMenu } from "./context-menus";
import { useUiState } from "../app/ui-state";

function useInteractiveSection(
    sectionRef: RefObject<HTMLDivElement>,
    dependencies: any[]
) {
    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) {
            return;
        }
        const child = section.children[0];
        child.className += " " + Classes.INTERACTIVE;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionRef, ...dependencies]);
}

/**
 * A list of elements in a document.
 */
export function DocumentList(): ReactNode {
    const navigate = useNavigate();
    const documents = useDocumentsQuery().data;
    const elements = useElementsQuery().data;
    const documentId = useParams({
        from: "/app/documents/$documentId"
    }).documentId;

    const search = useSearch({ from: "/app" });
    const searchDb = useSearchDb(documents, elements);
    const uiState = useUiState()[0];

    // Manually inject the interactive class into the section
    const sectionRef = useRef<HTMLDivElement>(null);

    // Include documents and elements as dependencies so it stays interactive even if the query isn't complete
    useInteractiveSection(sectionRef, [documents, elements, searchDb]);

    if (!documents || !elements || !searchDb) {
        return null;
    }

    const document = documents[documentId];

    let content;
    if (uiState.searchQuery) {
        content = (
            <SearchResults
                query={uiState.searchQuery}
                filters={{
                    vendors: uiState.vendorFilters,
                    documentId: document.documentId
                }}
            />
        );
    } else {
        // if (search.sortOrder == SortOrder.DEFAULT) {
        const documentSortOrder = document.sortAlphabetically
            ? SortOrder.ASCENDING
            : SortOrder.DEFAULT;
        // }

        let orderedElementIds = getElementOrder(searchDb, {
            sortOrder: documentSortOrder,
            elementIds: document.elementIds,
            vendors: uiState.vendorFilters,
            // Only show visible elements to users
            isVisible: !hasMemberAccess(search.currentAccessLevel)
        });

        if (documentSortOrder == SortOrder.DEFAULT) {
            orderedElementIds = document.elementIds.filter((elementId) =>
                orderedElementIds.includes(elementId)
            );
        }

        const orderedElements = orderedElementIds.map(
            (elementId) => elements[elementId]
        );
        content = orderedElements.map((element) => {
            return <ElementCard key={element.id} element={element} />;
        });
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
                        >
                            <SectionCard
                                // Stop propagation in the card so clicks around the edge/inside child cards don't close the section
                                onClick={(event) => event.stopPropagation()}
                                padded={false}
                                style={{ overflowY: "auto" }}
                            >
                                <CardList bordered={false} compact>
                                    {content}
                                </CardList>
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
