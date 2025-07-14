import { Icon, Card, EntityTitle, Classes } from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentObj, ElementObj } from "../api/backend-types";
import { CardThumbnail } from "./thumbnail";
import { FavoriteButton } from "./favorite";
import { AppDialog } from "../api/app-search";
import { useQuery } from "@tanstack/react-query";
import { getDocumentLoader, getFavoritesLoader } from "../queries";
import { useOnshapeData } from "../api/onshape-data";

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
                        style={{ lineHeight: "normal" }}
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
    const navigate = useNavigate();
    const onshapeData = useOnshapeData();
    const data = useQuery(getDocumentLoader()).data;
    const favorites = useQuery(getFavoritesLoader(onshapeData)).data;

    if (!data || !favorites) {
        return null;
    }

    const isFavorite = favorites[element.elementId] !== undefined;

    const thumbnail = <CardThumbnail path={element} />;

    const favoriteButton = (
        <FavoriteButton isFavorite={isFavorite} elementId={element.elementId} />
    );

    return (
        <Card
            interactive
            onClick={(event) => {
                event.stopPropagation();
                navigate({
                    to: ".",
                    search: {
                        activeDialog: AppDialog.INSERT_MENU,
                        activeElementId: element.elementId
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
            {favoriteButton}
        </Card>
    );
}
