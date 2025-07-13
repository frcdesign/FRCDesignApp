import { CardList, Classes, Section, SectionCard } from "@blueprintjs/core";
import {
    Outlet,
    useLoaderData,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { ReactNode, useLayoutEffect, useRef } from "react";
import { ElementCard } from "./cards";

/**
 * A list of elements in a document.
 */
export function DocumentList(): ReactNode {
    const navigate = useNavigate();
    const data = useLoaderData({ from: "/app/documents" });
    const documentId = useParams({
        from: "/app/documents/$documentId"
    }).documentId;

    const document = data.documents[documentId];
    const elements = document.elementIds.map(
        (elementId) => data.elements[elementId]
    );

    const cards = elements.map((element) => {
        return <ElementCard key={element.id} element={element} />;
    });

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

    return (
        <>
            <Section
                icon="arrow-left"
                ref={sectionRef}
                title={document.name}
                onClick={() => navigate({ to: "/app/documents" })}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%"
                }}
            >
                <SectionCard padded={false} style={{ overflow: "scroll" }}>
                    <CardList bordered={false} compact>
                        {cards}
                    </CardList>
                </SectionCard>
            </Section>
            <Outlet />
        </>
    );
}
