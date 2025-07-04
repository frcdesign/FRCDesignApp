import {
    Card,
    CardList,
    Classes,
    Colors,
    EntityTitle,
    H5,
    Icon,
    Section,
    SectionCard
} from "@blueprintjs/core";
import {
    Outlet,
    useLoaderData,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useLayoutEffect, useRef } from "react";
import { ElementObj } from "../api/backend-types";
import { CardThumbnail } from "./thumbnail";

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
                titleRenderer={H5}
                onClick={() => navigate({ to: "/app/documents" })}
            >
                <SectionCard padded={false}>
                    <CardList bordered={false}>{cards}</CardList>
                </SectionCard>
            </Section>
            <Outlet />
        </>
    );
}

interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
}

/**
 * A card representing a part studio or assembly.
 */
function ElementCard(props: ElementCardProps): ReactNode {
    const { element } = props;
    const navigate = useNavigate({
        from: "/app/documents/$documentId"
    });

    const thumbnail = <CardThumbnail path={element} />;

    const favoriteIcon = <Icon icon="heart" color={Colors.RED2} />;

    return (
        <Card
            interactive
            onClick={(event) => {
                event.stopPropagation();
                navigate({
                    to: "./elements/$elementId",
                    params: {
                        elementId: element.id
                    }
                });
            }}
            className="item-card"
        >
            <EntityTitle
                title={
                    <span style={{ lineHeight: "normal" }} title={element.name}>
                        {element.name}
                    </span>
                }
                icon={thumbnail}
                ellipsize
            />
            {favoriteIcon}
        </Card>
    );
}
