import {
    Card,
    CardList,
    Classes,
    Colors,
    EntityTitle,
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
import { CardThumbnail } from "./thumbnail";

/**
 * The list of all folders and/or top-level documents.
 */
export function HomeList(): ReactNode {
    const data = useLoaderData({ from: "/app/documents" });

    const cards = Object.entries(data.documents).map(([id, document]) => {
        return <DocumentCard key={id} document={document} />;
    });

    return (
        <>
            <Section
                title="Favorites"
                icon={<Icon icon="heart" color={Colors.RED3} />}
                collapsible
                collapseProps={{ defaultIsOpen: false }}
                compact
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
                collapsible
                collapseProps={{ defaultIsOpen: false }}
                compact
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
                collapsible
                compact
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
function DocumentCard(props: DocumentContainerProps): ReactNode {
    const { document } = props;
    const navigate = useNavigate();

    const thumbnail = <CardThumbnail path={document} />;

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
            {/* <Collapse>
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
