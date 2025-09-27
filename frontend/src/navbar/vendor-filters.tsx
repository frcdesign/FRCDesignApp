import { Button, ButtonVariant, Intent, Tag } from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { getVendorName, Vendor } from "../api/models";
import { useUiState } from "../app/ui-state";

export function VendorFilters(): ReactNode {
    const navigate = useNavigate();

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
                    if (areAllTagsActive) {
                        newFilters = [vendor];
                    } else if (isVendorActive) {
                        newFilters = vendorFilters.filter(
                            (curr) => curr !== vendor
                        );
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

    const clearButton = (
        <Button
            text="Clear"
            disabled={areAllTagsActive}
            variant={ButtonVariant.OUTLINED}
            icon="small-cross"
            onClick={() => {
                navigate({ to: ".", search: { vendors: undefined } });
            }}
        />
    );

    return (
        <div className="split" style={{ gap: "5x" }}>
            <div className="vendor-filter-tags">{filterTags}</div>
            {clearButton}
        </div>
    );
}
