import {
    createFileRoute,
    Outlet,
    useLoaderData,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { Box, Button, Group, Menu, Stack, Text } from "@mantine/core";
import {
    IconAlertTriangle,
    IconArrowBackUp,
    IconArrowLeft
} from "@tabler/icons-react";
import { IconSize } from "../../../common/style-constants";
import { ReactNode } from "react";
import { SearchResults } from "../../../search/search-results";
import { DocumentOut, Insertables } from "../../../../shared/api-models";
import { hasEditorAccess } from "../../../../shared/types";
import { filterInsertables } from "../../../search/filter";
import { DocumentMenuItems } from "../../../cards/document-card";
import { InsertableCard } from "../../../cards/insertable-card";
import { MenuButton, ItemTable } from "../../../cards/card-components";
import { SearchCallout } from "../../../search/search-errors";
import {
    PageError,
    SectionError,
    SectionLoading
} from "../../../common/app-zero-state";
import { ClearFiltersButton } from "../../../navbar/vendor-filters";
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
                        leftSection={<IconArrowBackUp size={IconSize.SMALL} />}
                        onClick={() => {
                            void navigate({ to: "/app/documents" });
                        }}
                    >
                        Go back
                    </Button>
                }
            />
        );
    }

    let content: ReactNode;
    if (uiState.searchQuery) {
        content = (
            <Stack gap={0}>
                <SearchResults
                    query={uiState.searchQuery}
                    filters={{
                        vendors: uiState.vendorFilters,
                        documentId: document.id
                    }}
                />
            </Stack>
        );
    } else {
        content = (
            <DocumentListContent
                document={document}
                insertables={insertables}
            />
        );
    }

    const menuItems = <DocumentMenuItems document={document} />;

    const headerRow = (
        <Box
            className="interactive mantine-auto-focus"
            onClick={() => void navigate({ to: "/app/documents" })}
            p="sm"
        >
            <Group wrap="nowrap" gap={0}>
                <Group wrap="nowrap" gap="sm">
                    <IconArrowLeft size={IconSize.MEDIUM} />
                    <Text size="md" fw={600} truncate>
                        {document.name}
                    </Text>
                </Group>
                <MenuButton>{menuItems}</MenuButton>
            </Group>
        </Box>
    );

    return (
        <>
            <Menu shadow="md" width={220} withinPortal>
                <Menu.ContextMenu>{headerRow}</Menu.ContextMenu>
                <Menu.Dropdown>{menuItems}</Menu.Dropdown>
            </Menu>
            {content}
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
                icon={
                    <IconAlertTriangle
                        size={IconSize.LARGE}
                        color="var(--mantine-color-yellow-6)"
                    />
                }
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
            <ItemTable>{insertableCards}</ItemTable>
        </>
    );
}
