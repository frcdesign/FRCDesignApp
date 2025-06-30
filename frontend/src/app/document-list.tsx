import {
    Card,
    CardList,
    Classes,
    EntityTitle,
    H5,
    Intent,
    Section,
    SectionCard,
    Tag
} from "@blueprintjs/core";
import {
    Outlet,
    useLoaderData,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useLayoutEffect, useRef } from "react";
import { ElementObj, ElementType } from "../api/backend-types";
import { Thumbnail } from "./thumbnail";

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
                <SectionCard
                    padded={false}
                    style={{
                        overflow: "scroll"
                    }}
                >
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

    const thumbnail = <Thumbnail path={element} />;

    const subtitle =
        element.elementType === ElementType.PART_STUDIO
            ? "Part studio"
            : "Assembly";

    const configurableTag = element.configurationId ? (
        <Tag intent={Intent.PRIMARY} round>
            Configurable
        </Tag>
    ) : undefined;

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
        >
            <EntityTitle
                icon={thumbnail}
                title={element.name}
                subtitle={subtitle}
                tags={configurableTag}
            />
        </Card>
    );
}
