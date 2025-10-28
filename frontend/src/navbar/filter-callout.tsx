import { Callout } from "@blueprintjs/core";
import { ClearFiltersButton } from "./vendor-filters";

interface FilterCalloutProps {
    /**
     * The name to use for elements currently being filtered.
     * e.g., "elements", "favorites", "search results"
     */
    itemName: string;

    /**
     * The number of items that are filtered out.
     */
    filteredItems: number;
}

export function FilterCallout(props: FilterCalloutProps) {
    const { filteredItems, itemName: itemType } = props;
    if (filteredItems === 0) {
        return null;
    }

    return (
        <Callout intent="primary" className="split">
            {`${filteredItems} ${itemType} are currently hidden by filters.`}
            <ClearFiltersButton />
        </Callout>
    );
}
