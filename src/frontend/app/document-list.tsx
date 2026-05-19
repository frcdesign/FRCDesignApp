import {
  Button,
  CardList,
  ContextMenuChildrenProps,
  Section,
  SectionCard,
} from "@blueprintjs/core";
import {
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { ReactNode, useRef } from "react";
import { SearchResults } from "../search/search-results";
import { DocumentObj, Elements } from "../api-utils/client-models";
import { hasEditorAccess } from "../../shared/types";
import { useUiState } from "../api-utils/ui-state";
import { filterElements, SortOrder } from "../search/filter";
import { DocumentContextMenu } from "../cards/document-card";
import { ElementCard } from "../cards/element-card";
import { ContextMenuButton } from "../cards/card-components";
import { SearchCallout } from "../search/search-errors";
import {
  SectionError,
  SectionLoading,
  PageError,
} from "../common/app-zero-state";
import { ClearFiltersButton } from "../navbar/vendor-filters";
// import { useInteractiveSection } from "../common/utils";
import { useLibraryQuery } from "../queries";

/**
 * A list of elements in a document.
 */
export function DocumentList(): ReactNode {
  const navigate = useNavigate();
  const libraryQuery = useLibraryQuery();
  const documentId = useParams({
    from: "/app/documents/$documentId",
  }).documentId;

  const uiState = useUiState()[0];

  // Manually inject the interactive class into the section
  const sectionRef = useRef<HTMLDivElement>(null);

  // Include documents and elements as dependencies so it stays interactive even if the query isn't complete
  // useInteractiveSection(sectionRef, [libraryQuery]);

  if (libraryQuery.isPending) {
    return <SectionLoading title="Loading documents..." />;
  } else if (libraryQuery.isError) {
    return <SectionError title="Failed to load document." />;
  }
  const documents = libraryQuery.data.documents;
  const elements = libraryQuery.data.elements;

  const document = documents[documentId];

  if (!document) {
    return (
      <PageError
        title="Document not found."
        justifyUp
        action={
          <Button
            text="Go back"
            icon="undo"
            intent="primary"
            onClick={() => navigate({ to: "/app/documents" })}
          />
        }
      />
    );
  }

  let content;
  if (uiState.searchQuery) {
    content = (
      <CardList bordered={false} compact>
        <SearchResults
          query={uiState.searchQuery}
          filters={{
            vendors: uiState.vendorFilters,
            documentId: document.id,
          }}
        />
      </CardList>
    );
  } else {
    content = <DocumentListContent document={document} elements={elements} />;
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
                navigate({ to: "/app/documents" });
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 0,
                maxHeight: "100%",
              }}
              rightElement={
                <ContextMenuButton onClick={ctxMenuProps.onContextMenu} />
              }
            >
              <SectionCard
                // Stop propagation in the card so clicks around the edge/inside child cards don't close the section
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
  document: DocumentObj;
  elements: Elements;
}

export function DocumentListContent(props: DocumentListCardsProps): ReactNode {
  const { document, elements } = props;

  const loaderData = useLoaderData({ from: "/app" });
  const uiState = useUiState()[0];

  const documentSortOrder = document.sortAlphabetically
    ? SortOrder.ASCENDING
    : SortOrder.DEFAULT;

  const documentElements = document.elementOrder
    .map((elementOrder) => elements[elementOrder])
    .filter((element) => !!element);

  if (documentElements.length === 0) {
    return (
      <SectionError
        title="This document has no visible elements"
        description={null}
      />
    );
  }

  const filterResult = filterElements(documentElements, {
    sortOrder: documentSortOrder,
    vendors: uiState.vendorFilters,
    // Only show visible elements to users
    isVisible: !hasEditorAccess(loaderData.currentAccessLevel),
  });

  if (filterResult.elements.length === 0) {
    return (
      <SectionError
        icon="warning-sign"
        iconIntent="warning"
        title="All elements are hidden by filters"
        description={null}
        action={<ClearFiltersButton />}
      />
    );
  }

  const elementCards = filterResult.elements.map((element) => (
    <ElementCard key={element.id} element={element} />
  ));

  const callout = (
    <SearchCallout objectLabel="element" filtered={filterResult.filtered} />
  );

  return (
    <>
      {callout}
      <CardList bordered={false} compact>
        {elementCards}
      </CardList>
    </>
  );
}
