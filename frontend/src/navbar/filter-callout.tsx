import { Callout } from "@blueprintjs/core";
import { ClearFiltersButton } from "./vendor-filters";

type ItemType = "elements" | "favorites";

interface FilterCalloutProps {
    /**
     * The type of elements currently being filtered.
     */
    itemType: ItemType;

    /**
     * The number of items that are filtered out.
     */
    filteredItems: number;
}

export function FilterCallout(props: FilterCalloutProps) {
    const { filteredItems, itemType } = props;
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
