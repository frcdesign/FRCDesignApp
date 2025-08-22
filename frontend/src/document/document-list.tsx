import { CardList, Classes, Section, SectionCard } from "@blueprintjs/core";
import {
    Outlet,
    useNavigate,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { ReactNode, useLayoutEffect, useRef } from "react";
import { ElementCard } from "../app/cards";
import { SearchResults } from "../app/search-results";
import { getElementOrder, SortOrder, useSearchDb } from "../api/search";
import { hasMemberAccess } from "../api/backend-types";
import { useDocumentsQuery, useElementsQuery } from "../queries";

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
    const searchDb = useSearchDb(elements);

    // Manually inject the interactive class into the section
    const sectionRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) {
            return;
        }
        const child = section.children[0];
        child.className += " " + Classes.INTERACTIVE;
        // Include documents and elements so it stays injected even if the query isn't complete
    }, [sectionRef, searchDb, documents, elements]);

    if (!documents || !elements || !searchDb) {
        return null;
    }

    const document = documents[documentId];

    let content;
    if (search.query) {
        content = (
            <SearchResults
                query={search.query}
                filters={{
                    vendors: search.vendors,
                    documentId: document.documentId
                }}
            />
        );
    } else {
        // if (search.sortOrder == SortOrder.DEFAULT) {
        const documentSortOrder = document.sortByDefault
            ? SortOrder.ASCENDING
            : SortOrder.DEFAULT;
        // }

        const orderedElementIds = getElementOrder(searchDb, {
            sortOrder: documentSortOrder,
            elementIds: document.elementIds,
            vendors: search.vendors,
            // Only show visible elements to users
            isVisible: !hasMemberAccess(search.accessLevel)
        });

        const orderedElements = orderedElementIds.map(
            (elementId) => elements[elementId]
        );
        content = orderedElements.map((element) => {
            return <ElementCard key={element.id} element={element} />;
        });
    }

    return (
        <>
            <Section
                icon="arrow-left"
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
                    style={{ overflow: "scroll" }}
                >
                    <CardList bordered={false} compact>
                        {content}
                    </CardList>
                </SectionCard>
            </Section>
            <Outlet />
        </>
    );
}
