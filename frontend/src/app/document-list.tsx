import { Collapse, Section } from "@blueprintjs/core";
import { Outlet, useLoaderData, useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
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
            <div
                style={{
                    marginTop: "10px",
                    marginRight: "10px",
                    marginLeft: "10px",
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                {cards}
            </div>
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
    const [isOpen, setIsOpen] = useState(false);

    // Section likes to wrap it's own collapse
    // Wrap in a div (rather than <>) so gap doesn't apply to both section and collapse
    return (
        <div>
            <Section
                onClick={() => setIsOpen(!isOpen)}
                collapseProps={{ defaultIsOpen: false }}
                title={document.name}
                className="document-section"
                collapsible
                icon={thumbnail}
            />
            <Collapse isOpen={isOpen}>{props.children}</Collapse>
        </div>
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

    return (
        <Section
            title={element.name}
            subtitle={subtitle}
            onClick={() =>
                navigate({
                    to: "/app/documents/$elementId",
                    params: { elementId: element.id }
                })
            }
            icon={thumbnail}
            style={{
                paddingLeft: "20px",
                marginBottom: "10px"
            }}
        />
        // <Card
        //     interactive
        //     onClick={() =>
        //         navigate({
        //             to: "/app/documents/$elementId",
        //             params: { elementId: element.id }
        //         })
        //     }
        //     style={{ margin: "10px" }}
        // >
        //     <EntityTitle
        //         icon={thumbnail}
        //         className="entity-title"
        //         title={element.name}
        //         subtitle={subtitle}
        //     />
        // </Card>
    );
}
