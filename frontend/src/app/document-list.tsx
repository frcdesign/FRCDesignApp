import {
    Card,
    CardList,
    EntityTitle,
    Intent,
    Section,
    SectionCard,
    Tag
} from "@blueprintjs/core";
import { Outlet, useLoaderData, useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentObj, ElementObj, ElementType } from "../api/backend-types";
import { Thumbnail } from "./thumbnail";

export function DocumentList(): ReactNode {
    const data = useLoaderData({ from: "/app/documents" });

    const cards = Object.entries(data.documents).map(([id, document]) => {
        return (
            <DocumentContainer key={id} document={document}>
                {document.elementIds.map((elementId) => {
                    const element = data.elements[elementId];
                    return <ElementCard key={elementId} element={element} />;
                })}
            </DocumentContainer>
        );
    });

    return (
        <>
            {cards}
            <Outlet />
        </>
    );
}

interface DocumentContainerProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card containing one or more elements.
 */
function DocumentContainer(props: DocumentContainerProps): ReactNode {
    const { document } = props;
    const thumbnail = <Thumbnail path={document} />;
    return (
        <Section
            collapsible
            collapseProps={{ defaultIsOpen: false }}
            title={document.name}
            icon={thumbnail}
        >
            <SectionCard
                padded={false}
                style={{
                    maxHeight: "250px",
                    overflow: "scroll"
                }}
            >
                <CardList bordered={false}>{props.children}</CardList>
            </SectionCard>
        </Section>
    );
}

interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
}

function ElementCard(props: ElementCardProps): ReactNode {
    const { element } = props;
    const navigate = useNavigate();

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
            onClick={() =>
                navigate({
                    to: "/app/documents/$elementId",
                    params: { elementId: element.id }
                })
            }
        >
            <EntityTitle
                icon={thumbnail}
                className="document-title"
                title={element.name}
                subtitle={subtitle}
                tags={configurableTag}
            />
        </Card>
    );
}
