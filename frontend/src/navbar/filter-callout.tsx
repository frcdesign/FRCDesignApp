import { Callout } from "@blueprintjs/core";
import { ClearFiltersButton } from "./vendor-filters";

type ItemType = "elements" | "favorites" | "search results";

interface FilterCalloutProps {
    /**
     * The type of elements currently being filtered.
     */
    itemType: ItemType;

    /**
     * The number of items that are filtered out, or `undefined` if unknown.
     */
    filteredItems?: number;
}

export function FilterCallout(props: FilterCalloutProps) {
    const { filteredItems, itemType } = props;
    if (filteredItems === 0) {
        return null;
    }
    let message: string;
    if (filteredItems === undefined) {
        message = `Some ${itemType} may be hidden by filters.`;
    } else {
        message = `${filteredItems} ${itemType} are currently hidden by filters.`;
    }

    return (
        <Callout intent="primary" className="split">
            {message}
            <ClearFiltersButton />
        </Callout>
    );
}
