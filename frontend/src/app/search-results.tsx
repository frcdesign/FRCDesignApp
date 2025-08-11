import { NonIdealState, Icon, NonIdealStateIconSize } from "@blueprintjs/core";
import { ReactNode, useState, useEffect } from "react";
import { DocumentResult } from "../api/backend-types";
import { SearchFilters, SearchHit, doSearch, useSearchDb } from "../api/search";
import { ElementCard } from "./cards";

interface SearchResultsProps {
    data: DocumentResult;
    query: string;
    filters: SearchFilters;
}

export function SearchResults(props: SearchResultsProps): ReactNode {
    const { data, query, filters } = props;

    const searchDb = useSearchDb(data);

    const [searchHits, setSearchHits] = useState<SearchHit[] | undefined>(
        undefined
    );

    useEffect(() => {
        const search = async () => {
            if (!searchDb) {
                return;
            }
            setSearchHits(await doSearch(searchDb, query, filters));
        };

        search();
    }, [searchDb, query, filters]);

    if (!searchDb || !searchHits) {
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
            const element = data.elements[elementId];
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
