import { Icon, Colors, Card, EntityTitle, Classes } from "@blueprintjs/core";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentObj, ElementObj } from "../api/backend-types";
import { CardThumbnail } from "./thumbnail";

interface DocumentCardProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card representing a single document.
 */
export function DocumentCard(props: DocumentCardProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

    const thumbnail = <CardThumbnail path={document} />;

    return (
        <Card
            interactive
            onClick={() =>
                navigate({
                    to: "/app/documents/$documentId",
                    params: { documentId: document.id }
                })
            }
            className="item-card"
        >
            <EntityTitle
                title={
                    <span
                        style={{
                            lineHeight: "normal"
                        }}
                        title={document.name}
                    >
                        {document.name}
                    </span>
                }
                icon={thumbnail}
                ellipsize
            />
            <Icon icon="arrow-right" className={Classes.TEXT_MUTED} />
        </Card>
    );
}

interface ElementCardProps extends PropsWithChildren {
    element: ElementObj;
}

/**
 * A card representing a part studio or assembly.
 */
export function ElementCard(props: ElementCardProps): ReactNode {
    const { element } = props;
    const navigate = useNavigate({
        from: "/app/documents/$documentId"
    });
    const data = useLoaderData({ from: "/app/documents" });
    const isFavorite = data.favorites[element.elementId] !== undefined;

    const thumbnail = <CardThumbnail path={element} />;

    const favoriteIcon = isFavorite ? (
        <Icon icon="heart" color={Colors.RED2} />
    ) : null;

    return (
        <Card
            compact
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
