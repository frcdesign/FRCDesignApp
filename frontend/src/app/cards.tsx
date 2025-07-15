import {
    Icon,
    Card,
    EntityTitle,
    Classes,
    Text,
    Alert,
    Intent
} from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentObj, ElementObj, ElementType } from "../api/backend-types";
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
            onClick={() => {
                navigate({
                    to: "/app/documents/$documentId",
                    params: { documentId: document.id }
                });
            }}
            className="item-card"
        >
            <EntityTitle
                title={<Text>{document.name}</Text>}
                icon={thumbnail}
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

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    if (!data || !favorites) {
        return null;
    }

    const isAssemblyInPartStudio =
        element.elementType === ElementType.ASSEMBLY &&
        onshapeData.elementType == ElementType.PART_STUDIO;

    const isFavorite = favorites[element.elementId] !== undefined;

    const thumbnail = <CardThumbnail path={element} />;

    const favoriteButton = (
        <FavoriteButton isFavorite={isFavorite} element={element} />
    );

    const alert = (
        <Alert
            isOpen={isAlertOpen}
            canEscapeKeyCancel
            canOutsideClickCancel
            onClose={(_, event) => {
                event?.stopPropagation();
                setIsAlertOpen(false);
            }}
            confirmButtonText="Close"
            icon="cross"
            intent={Intent.DANGER}
        >
            This part is an assembly and cannot be derived into a part studio.
        </Alert>
    );

    return (
        <Card
            interactive
            onClick={(event) => {
                event.stopPropagation();
                if (isAssemblyInPartStudio) {
                    setIsAlertOpen(true);
                } else {
                    navigate({
                        to: ".",
                        search: {
                            activeDialog: AppDialog.INSERT_MENU,
                            activeElementId: element.elementId
                        }
                    });
                }
            }}
            className="item-card"
        >
            <EntityTitle
                className={
                    isAssemblyInPartStudio ? Classes.TEXT_DISABLED : undefined
                }
                title={<Text>{element.name}</Text>}
                icon={thumbnail}
            />
            {favoriteButton}
            {alert}
        </Card>
    );
}
