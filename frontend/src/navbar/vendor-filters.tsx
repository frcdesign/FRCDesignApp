import { Button, ButtonVariant, Intent, Size, Tag } from "@blueprintjs/core";
import { ReactNode } from "react";
import { getVendorName, Vendor } from "../api/models";
import { useUiState } from "../api/ui-state";

interface ClearFiltersButtonProps {
    /**
     * @default "Clear filters"
     */
    text?: string;
    standardSize?: boolean;
}

export function ClearFiltersButton(props: ClearFiltersButtonProps): ReactNode {
    const [uiState, setUiState] = useUiState();
    const text = props.text ?? "Clear filters";
    const standardSize = props.standardSize ?? false;

    const vendorFilters = uiState.vendorFilters;
    const areAllTagsActive = vendorFilters === undefined;

    return (
        <Button
            text={text}
            disabled={areAllTagsActive}
            variant={ButtonVariant.OUTLINED}
            size={standardSize ? Size.MEDIUM : Size.SMALL}
            icon="filter-remove"
            onClick={() => {
                setUiState({ vendorFilters: undefined });
            }}
        />
    );
}

export function VendorFilters(): ReactNode {
    const [uiState, setUiState] = useUiState();

    const vendorFilters = uiState.vendorFilters;

    const areAllTagsActive = vendorFilters === undefined;

    const filterTags = Object.values(Vendor).map((vendor) => {
        const isVendorActive =
            areAllTagsActive || vendorFilters.includes(vendor);
        return (
            <Tag
                round
                interactive
                key={vendor}
                intent={Intent.PRIMARY}
                title={getVendorName(vendor)}
                onClick={() => {
                    let newFilters;
                    if (vendorFilters === undefined) {
                        // First filter selected
                        newFilters = [vendor];
                    } else if (isVendorActive) {
                        // Filter is already selected
                        newFilters = vendorFilters.filter(
                            (curr) => curr !== vendor
                        );
                        // It was the last filter
                        if (newFilters.length === 0) {
                            newFilters = undefined;
                        }
                    } else {
                        newFilters = [...vendorFilters, vendor];
                    }
                    setUiState({ vendorFilters: newFilters });
                }}
                active={!isVendorActive} // The active prop of tags is backwards
            >
                {vendor}
            </Tag>
        );
    });

    return (
        <div className="split" style={{ gap: "5x" }}>
            <div className="vendor-filter-tags">{filterTags}</div>
            <ClearFiltersButton text="Clear" />
        </div>
    );
}
