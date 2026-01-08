import { Button, ButtonVariant, Intent, Size, Tag } from "@blueprintjs/core";
import { ReactNode, useCallback } from "react";
import { getVendorName, Vendor } from "../api/models";
import { SetUiState, useUiState } from "../api/ui-state";
// import { Select } from "@blueprintjs/select";

interface ClearFiltersButtonProps {
    /**
     * @default "Clear filters"
     */
    text?: string;
    /**
     * @default false
     */
    small?: boolean;
}

export function ClearFiltersButton(props: ClearFiltersButtonProps): ReactNode {
    const [uiState, setUiState] = useUiState();
    const text = props.text ?? "Clear filters";
    const small = props.small ?? false;

    const vendorFilters = uiState.vendorFilters;
    const areAllTagsActive = vendorFilters === undefined;

    return (
        <Button
            text={text}
            disabled={areAllTagsActive}
            variant={ButtonVariant.OUTLINED}
            size={small ? Size.SMALL : Size.MEDIUM}
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

    const handleVendorSelect = useOnVendorSelect(vendorFilters, setUiState);

    const filterTags = Object.values(Vendor).map((vendor) => {
        const isActive = isVendorActive(vendor, vendorFilters);
        return (
            <Tag
                round
                interactive
                key={vendor}
                intent={Intent.PRIMARY}
                title={getVendorName(vendor)}
                onClick={() => {
                    handleVendorSelect(vendor);
                }}
                active={!isActive} // The active prop of tags is backwards
            >
                {vendor}
            </Tag>
        );
    });

    console.log(vendorFilters);

    return (
        <div className="split" style={{ gap: "5x" }}>
            <div className="vendor-filter-tags">{filterTags}</div>
            <ClearFiltersButton text="Clear" small />
        </div>
    );
}

function isVendorActive(
    vendor: Vendor,
    currentFilters: Vendor[] | undefined
): boolean {
    const areAllTagsActive = currentFilters === undefined;
    if (areAllTagsActive) {
        return true;
    } else if (currentFilters.includes(vendor)) {
        return true;
    }
    return false;
}

function useOnVendorSelect(
    currentFilters: Vendor[] | undefined,
    setUiState: SetUiState
) {
    return useCallback(
        (vendor: Vendor) => {
            let newFilters;
            if (currentFilters === undefined) {
                // First filter selected
                newFilters = [vendor];
            } else if (isVendorActive(vendor, currentFilters)) {
                // Filter is already selected
                newFilters = currentFilters.filter((curr) => curr !== vendor);
                // It was the last filter
                if (newFilters.length === 0) {
                    newFilters = undefined;
                }
            } else {
                newFilters = [...currentFilters, vendor];
            }
            setUiState({ vendorFilters: newFilters });
        },
        [currentFilters, setUiState]
    );
}
