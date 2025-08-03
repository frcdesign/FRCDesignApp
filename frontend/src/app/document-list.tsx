import { CardList, Classes, Section, SectionCard } from "@blueprintjs/core";
import {
    Outlet,
    useNavigate,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { ReactNode, useLayoutEffect, useRef } from "react";
import { ElementCard, SearchResults } from "./cards";
import { getDocumentLoader } from "../queries";
import { useQuery } from "@tanstack/react-query";

/**
 * A list of elements in a document.
 */
export function DocumentList(): ReactNode {
    const navigate = useNavigate();
    const data = useQuery(getDocumentLoader()).data;
    const documentId = useParams({
        from: "/app/documents/$documentId"
    }).documentId;

    const search = useSearch({ from: "/app" });

    // Manually inject the interactive class into the section
    const sectionRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) {
            return;
        }
        const child = section.children[0];
        child.className += " " + Classes.INTERACTIVE;
    }, [sectionRef]);

    if (!data) {
        return null;
    }

    const document = data.documents[documentId];

    let content;
    if (search.query) {
        content = (
            <SearchResults
                query={search.query}
                data={data}
                vendors={search.vendors}
                documentId={documentId}
            />
        );
    } else {
        const elements = document.elementIds.map(
            (elementId) => data.elements[elementId]
        );
        content = elements.map((element) => {
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
                <SectionCard padded={false} style={{ overflow: "scroll" }}>
                    <CardList bordered={false} compact>
                        {content}
                    </CardList>
                </SectionCard>
            </Section>
            <Outlet />
        </>
    );
}
