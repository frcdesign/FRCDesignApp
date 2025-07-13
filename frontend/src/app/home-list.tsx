import {
    Card,
    CardList,
    Collapse,
    Colors,
    H6,
    Icon,
    Intent,
    NonIdealState,
    NonIdealStateIconSize
} from "@blueprintjs/core";
import { Outlet, useLoaderData } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode, useState } from "react";
import { DocumentCard, ElementCard } from "./cards";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const data = useLoaderData({ from: "/app/documents" });

    const documentCards = Object.entries(data.documents).map(
        ([id, document]) => {
            return <DocumentCard key={id} document={document} />;
        }
    );

    let favoritesContent;
    if (Object.keys(data.favorites).length > 0) {
        favoritesContent = Object.keys(data.favorites).map((id: string) => {
            // Have to guard against elements in case we ever deprecate a document
            const element = data.elements[id];
            console.log(element);
            if (!element) {
                return null;
            }
            return <ElementCard key={id} element={element} />;
        });
        console.log(data.favorites);
        console.log(data.elements);
    } else {
        favoritesContent = (
            <NonIdealState
                icon={
                    <Icon
                        icon="cross"
                        size={NonIdealStateIconSize.STANDARD}
                        intent={Intent.DANGER}
                    />
                }
                iconMuted={false}
                title="No favorites"
                description="Favorite some stuff first!"
                className="home-error-state"
            />
        );
    }

    return (
        <>
            <CardList compact bordered={false}>
                <ListContainer
                    icon={<Icon icon="heart" color={Colors.RED3} />}
                    title="Favorites"
                >
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

export function ListContainer(props: ListContainerProps): ReactNode {
    const { icon, title, children } = props;
    const [isOpen, setIsOpen] = useState(props.defaultIsOpen ?? true);
    return (
        <>
            <Card
                className="home-card"
                onClick={() => setIsOpen(!isOpen)}
                interactive
            >
                <div className="home-card-title">
                    {icon}
                    <H6 style={{ marginBottom: "1px" }}>{title}</H6>
                </div>
                <Icon icon={isOpen ? "chevron-up" : "chevron-down"} />
            </Card>
            <Collapse isOpen={isOpen}>
                <CardList compact>{children}</CardList>
            </Collapse>
        </>
    );
}
