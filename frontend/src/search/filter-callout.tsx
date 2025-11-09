import { Callout } from "@blueprintjs/core";
import { ClearFiltersButton } from "../navbar/vendor-filters";
import { ObjectLabel } from "./search";

interface FilterCalloutProps {
    objectLabel: ObjectLabel;
    filtered: number;
}

/**
 * A callout which renders whenever there are items hidden by filters.
 */
export function FilterCallout(props: FilterCalloutProps) {
    const { filtered, objectLabel } = props;
    if (filtered === 0) {
        return null;
    }

    return (
        <Callout intent="primary" className="split">
            {`${filtered} ${objectLabel} are currently hidden by filters.`}
            <ClearFiltersButton />
        </Callout>
    );
}
