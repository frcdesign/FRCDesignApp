import {
    Card,
    CardList,
    Classes,
    Collapse,
    Colors,
    H6,
    Icon,
    NonIdealState,
    NonIdealStateIconSize
} from "@blueprintjs/core";
import { Outlet } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentCard, ElementCard } from "./cards";
import { FavoriteIcon } from "./favorite";
import { getDocumentLoader, getFavoritesLoader } from "../queries";
import { useQuery } from "@tanstack/react-query";
import { useOnshapeData } from "../api/onshape-data";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const data = useQuery(getDocumentLoader()).data;
    const onshapeData = useOnshapeData();
    const favorites = useQuery(getFavoritesLoader(onshapeData)).data;

    if (!data || !favorites) {
        return null;
    }

    const documentCards = Object.entries(data.documents).map(
        ([id, document]) => {
            return <DocumentCard key={id} document={document} />;
        }
    );

    let favoritesContent;
    if (Object.keys(favorites).length > 0) {
        favoritesContent = Object.keys(favorites).map((id: string) => {
            // Have to guard against elements in case we ever deprecate a document
            const element = data.elements[id];
            if (!element) {
                return null;
            }
            return <ElementCard key={id} element={element} />;
        });
    } else {
        favoritesContent = (
            <NonIdealState
                icon={
                    <Icon
                        icon="heart-broken"
                        size={NonIdealStateIconSize.SMALL}
                        color={Colors.RED3}
                        style={{ marginBottom: "-5px" }}
                    />
                }
                title="No favorites"
                className="home-error-state"
            />
        );
    }

    return (
        <>
            <CardList compact bordered={false}>
                <ListContainer icon={<FavoriteIcon />} title="Favorites">
                    {favoritesContent}
                </ListContainer>
                <ListContainer
                    icon={<Icon icon="manual" className="frc-design-green" />}
                    title="Library"
                >
                    {documentCards}
                </ListContainer>
            </CardList>
            <Outlet />
        </>
    );
}

interface ListContainerProps extends PropsWithChildren {
    /**
     * Whether the section is open by default.
     * Defaults to true.
     */
    defaultIsOpen?: boolean;
    icon: ReactNode;
    title: string;
}

function ListContainer(props: ListContainerProps): ReactNode {
    const { icon, title, children } = props;
    const [isOpen, setIsOpen] = useState(props.defaultIsOpen ?? true);
    return (
        <>
            <Card
                className="split"
                onClick={() => setIsOpen(!isOpen)}
                interactive
            >
                <div className="home-card-title">
                    {icon}
                    <H6 style={{ marginBottom: "1px" }}>{title}</H6>
                </div>
                <Icon
                    icon={isOpen ? "chevron-up" : "chevron-down"}
                    className={Classes.TEXT_MUTED}
                />
            </Card>
            <Collapse isOpen={isOpen}>
                <CardList compact>{children}</CardList>
            </Collapse>
        </>
    );
}
