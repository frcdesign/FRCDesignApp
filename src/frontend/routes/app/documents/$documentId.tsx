import {
    createFileRoute,
    Outlet,
    useLoaderData,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import {
    Button,
    CardList,
    ContextMenuChildrenProps,
    Section,
    SectionCard
} from "@blueprintjs/core";
import { ReactNode, useRef } from "react";
import { SearchResults } from "../../../search/search-results";
import { DocumentOut, Insertables } from "../../../../shared/api-models";
import { hasEditorAccess } from "../../../../shared/types";
import { filterInsertables } from "../../../search/filter";
import { DocumentContextMenu } from "../../../cards/document-card";
import { InsertableCard } from "../../../cards/insertable-card";
import { ContextMenuButton } from "../../../cards/card-components";
import { SearchCallout } from "../../../search/search-errors";
import {
    PageError,
    SectionError,
    SectionLoading
} from "../../../common/app-zero-state";
import { ClearFiltersButton } from "../../../navbar/vendor-filters";
import { useInteractiveSection } from "../../../common/utils";
import { useLibraryQuery } from "../../../queries";
import { useUiState, updateUiState } from "../../../api-utils/ui-state";

export const Route = createFileRoute("/app/documents/$documentId")({
    component: DocumentList,
    onEnter: (match) => {
        updateUiState({ openDocumentId: match.params.documentId });
    }
});

function DocumentList(): ReactNode {
    const navigate = useNavigate();
    const libraryQuery = useLibraryQuery();
    const documentId = useParams({
        from: "/app/documents/$documentId"
    }).documentId;

    const uiState = useUiState()[0];

    const sectionRef = useRef<HTMLDivElement>(null);

    useInteractiveSection(sectionRef, [libraryQuery]);

    if (libraryQuery.isPending) {
        return <SectionLoading title="Loading documents..." />;
    } else if (libraryQuery.isError) {
        return <SectionError title="Failed to load document." />;
    }
    const documents = libraryQuery.data.documents;
    const insertables = libraryQuery.data.insertables;

    const document = documents[documentId];

    if (!document) {
        return (
            <PageError
                title="Document not found"
                description={null}
                justifyUp
                action={
                    <Button
                        text="Go back"
                        icon="undo"
                        intent="primary"
                        onClick={() => {
                            void navigate({ to: "/app/documents" });
                        }}
                    />
                }
            />
        );
    }

    let content: ReactNode;
    if (uiState.searchQuery) {
        content = (
            <CardList bordered={false} compact>
                <SearchResults
                    query={uiState.searchQuery}
                    filters={{
                        vendors: uiState.vendorFilters,
                        documentId: document.id
                    }}
                />
            </CardList>
        );
    } else {
        content = (
            <DocumentListContent
                document={document}
                insertables={insertables}
            />
        );
    }

    return (
        <>
            <DocumentContextMenu document={document}>
                {(ctxMenuProps: ContextMenuChildrenProps) => (
                    <>
                        <Section
                            icon="arrow-left"
                            onContextMenu={ctxMenuProps.onContextMenu}
                            ref={sectionRef}
                            title={document.name}
                            onClick={() => {
                                void navigate({ to: "/app/documents" });
                            }}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flexGrow: 0,
                                maxHeight: "100%"
                            }}
                            rightElement={
                                <ContextMenuButton
                                    onClick={ctxMenuProps.onContextMenu}
                                />
                            }
                        >
                            <SectionCard
                                onClick={(event) => event.stopPropagation()}
                                padded={false}
                                style={{ overflowY: "auto" }}
                            >
                                {content}
                            </SectionCard>
                        </Section>
                        {ctxMenuProps.popover}
                    </>
                )}
            </DocumentContextMenu>
            <Outlet />
        </>
    );
}

interface DocumentListCardsProps {
    document: DocumentOut;
    insertables: Insertables;
}

export function DocumentListContent(props: DocumentListCardsProps): ReactNode {
    const { document, insertables } = props;

    const loaderData = useLoaderData({ from: "/app" });
    const uiState = useUiState()[0];

    const documentInsertables = document.insertableOrder
        .map((insertableId) => insertables[insertableId])
        .filter((insertable) => !!insertable);

    if (documentInsertables.length === 0) {
        return (
            <SectionError
                title="This document has no visible elements"
                description={null}
            />
        );
    }

    const filterResult = filterInsertables(documentInsertables, {
        vendors: uiState.vendorFilters,
        isVisible: !hasEditorAccess(loaderData.currentAccessLevel)
    });

    if (filterResult.insertables.length === 0) {
        return (
            <SectionError
                icon="warning-sign"
                iconIntent="warning"
                title="All elements are hidden by filters"
                action={<ClearFiltersButton />}
            />
        );
    }

    const insertableCards = filterResult.insertables.map((insertable) => (
        <InsertableCard key={insertable.id} insertable={insertable} />
    ));

    const callout = (
        <SearchCallout objectLabel="element" filtered={filterResult.filtered} />
    );

    return (
        <>
            {callout}
            <CardList bordered={false} compact>
                {insertableCards}
            </CardList>
        </>
    );
}
