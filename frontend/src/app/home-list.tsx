import {
    Card,
    CardList,
    Classes,
    Colors,
    EntityTitle,
    H5,
    Icon,
    Intent,
    NonIdealState,
    NonIdealStateIconSize,
    Section,
    SectionCard
} from "@blueprintjs/core";
import { Outlet, useLoaderData, useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { DocumentObj } from "../api/backend-types";
import { Thumbnail } from "./thumbnail";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const data = useLoaderData({ from: "/app/documents" });

    const cards = Object.entries(data.documents).map(([id, document]) => {
        return <DocumentContainer key={id} document={document} />;
    });

    return (
        <>
            <Section
                title="Favorites"
                icon={<Icon icon="heart" color={Colors.RED3} />}
                titleRenderer={H5}
                collapsible
                collapseProps={{ defaultIsOpen: false }}
            >
                <SectionCard padded={false}>
                    <NonIdealState
                        className="no-items-error"
                        icon={
                            <Icon
                                intent={Intent.DANGER}
                                icon="cross"
                                size={NonIdealStateIconSize.STANDARD}
                            />
                        }
                        title="No Items Found"
                        description="Parts you've marked as favorites will appear here."
                    />
                </SectionCard>
            </Section>
            <Section
                title="Recently Used"
                icon={<Icon icon="time" color={Colors.BLUE3} />}
                titleRenderer={H5}
                collapsible
                collapseProps={{ defaultIsOpen: false }}
            >
                <SectionCard padded={false}>
                    <NonIdealState
                        className="no-items-error"
                        icon={
                            <Icon
                                intent={Intent.DANGER}
                                icon="cross"
                                size={NonIdealStateIconSize.STANDARD}
                            />
                        }
                        title="No Items Found"
                        description="Parts you've recently used will appear here."
                    />
                </SectionCard>
            </Section>
            <Section
                title="Library"
                icon={<Icon icon="manual" className="frc-design-green" />}
                titleRenderer={H5}
                collapsible
            >
                <SectionCard padded={false}>
                    <CardList bordered={false}>{cards}</CardList>
                </SectionCard>
            </Section>
            <Outlet />
        </>
    );
}

interface DocumentContainerProps extends PropsWithChildren {
    document: DocumentObj;
}

/**
 * A collapsible card representing a single document.
 */
function DocumentContainer(props: DocumentContainerProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

    const thumbnail = <Thumbnail path={document} />;

    return (
        <>
            <Card
                interactive
                onClick={() =>
                    navigate({
                        to: "/app/documents/$documentId",
                        params: { documentId: document.id }
                    })
                }
                style={{ display: "flex", justifyContent: "space-between" }}
            >
                <EntityTitle title={document.name} icon={thumbnail} />
                <Icon icon="arrow-right" className={Classes.TEXT_MUTED} />
            </Card>
            {/* <Collapse isOpen>
                <Section>
                    <SectionCard padded={false}>
                        <CardList bordered={false}>
                            <Card interactive style={{ width: "100%" }}>
                                <span>Ahhh</span>
                            </Card>
                            <Card interactive>
                                <span>Ahhh</span>
                            </Card>
                        </CardList>
                    </SectionCard>
                </Section>
            </Collapse> */}
        </>
    );
}
