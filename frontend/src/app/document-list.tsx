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
import { DocumentThumbnail, ElementThumbnail } from "./thumbnail";

function findElement(
    elements: ElementObj[],
    elementId: string
): ElementObj | undefined {
    return elements.find((element) => element.id === elementId);
}

export function DocumentList(): ReactNode {
    const data = useLoaderData({ from: "/app/documents" });

    const cards = data.documents.map((document) => {
        return (
            <DocumentContainer key={document.id} document={document}>
                {document.elementIds.map((elementId) => {
                    const element = findElement(data.elements, elementId);
                    if (!element) {
                        return null;
                    }
                    return <ElementCard key={element.id} element={element} />;
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
    const thumbnail = <DocumentThumbnail instancePath={document} />;
    return (
        <Section collapsible title={document.name} icon={thumbnail}>
            <SectionCard
                padded={false}
                style={{
                    maxHeight: "300px",
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

    const thumbnail = <ElementThumbnail elementPath={element} />;

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
