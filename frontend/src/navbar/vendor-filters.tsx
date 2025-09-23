import { Button, ButtonVariant, Intent, Tag } from "@blueprintjs/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ReactNode } from "react";
import { getVendorName, Vendor } from "../api/models";

export function VendorFilters(): ReactNode {
    const navigate = useNavigate();
    const vendors = useSearch({ from: "/app" }).vendors;

    const areAllTagsActive = vendors === undefined;

    const filterTags = Object.values(Vendor).map((vendor) => {
        const isVendorActive = areAllTagsActive || vendors.includes(vendor);
        return (
            <Tag
                round
                interactive
                key={vendor}
                intent={Intent.PRIMARY}
                title={getVendorName(vendor)}
                onClick={() => {
                    let newVendors;
                    if (areAllTagsActive) {
                        newVendors = [vendor];
                    } else if (isVendorActive) {
                        newVendors = vendors.filter((curr) => curr !== vendor);
                        if (newVendors.length === 0) {
                            newVendors = undefined;
                        }
                    } else {
                        newVendors = [...vendors, vendor];
                    }
                    navigate({ to: ".", search: { vendors: newVendors } });
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
