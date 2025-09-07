import { NonIdealState, Icon, NonIdealStateIconSize } from "@blueprintjs/core";
import { ReactNode, useState, useEffect } from "react";
import { SearchHit, doSearch, useSearchDb } from "../api/search";
import { ElementCard } from "../document/cards";
import { useElementsQuery } from "../queries";
import { Vendor } from "../api/backend-types";

interface SearchResultsProps {
    query: string;
    filters: {
        vendors?: Vendor[];
        documentId?: string;
    };
}

export function SearchResults(props: SearchResultsProps): ReactNode {
    const { query, filters } = props;

    const elements = useElementsQuery().data;

    const searchDb = useSearchDb(elements);

    const [searchHits, setSearchHits] = useState<SearchHit[] | undefined>(
        undefined
    );

    useEffect(() => {
        const executeSearch = async () => {
            if (!searchDb) {
                return;
            }
            const hits = await doSearch(searchDb, query, filters);
            setSearchHits(hits);
        };

        executeSearch();
    }, [searchDb, query, filters]);

    if (!searchDb || !searchHits || !elements) {
        return null;
    }

    let content = null;
    if (searchHits.length === 0) {
        content = (
            <div style={{ height: "150px" }}>
                <NonIdealState
                    icon={
                        <Icon
                            icon="search"
                            size={NonIdealStateIconSize.STANDARD}
                        />
                    }
                    title="No search results"
                />
            </div>
        );
    } else {
        content = searchHits.map((searchHit: SearchHit) => {
            const elementId = searchHit.id;
            const element = elements[elementId];
            return (
                <ElementCard
                    key={elementId}
                    element={element}
                    searchHit={searchHit}
                />
            );
        });
    }

    return content;
}
