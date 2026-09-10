import { ActionIcon, Button, Menu } from "@mantine/core";
import { FunnelIcon, FunnelXIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import {
    getLibraryVendors,
    getVendorName,
    Vendor
} from "@backend/features/library/vendors";
import { useGetUiState, useSetUiState } from "../../../lib/ui-state";
import { AppContextMenu } from "../../../components/app-menu";
import { useLibraryId } from "../../library/library-path";

/**
 * The active filters, narrowed to what this library stocks — a filter picked in
 * another library would otherwise hide everything with nothing on screen
 * explaining why. `undefined` means every vendor is active.
 */
export function useVendorFilters(): Vendor[] | undefined {
    const vendorFilters = useGetUiState().vendorFilters;
    const libraryVendors = getLibraryVendors(useLibraryId());
    if (!vendorFilters) {
        return undefined;
    }
    const kept = vendorFilters.filter((vendor) =>
        libraryVendors.includes(vendor)
    );
    return kept.length > 0 ? kept : undefined;
}

interface ClearFiltersButtonProps {
    /** @default "Clear filters" */
    text?: string;
    /** @default false */
    small?: boolean;
}

export function ClearFiltersButton(props: ClearFiltersButtonProps): ReactNode {
    const { text = "Clear filters", small = false } = props;
    const uiState = useGetUiState();
    const setUiState = useSetUiState();

    const vendorFilters = uiState.vendorFilters;
    const areAllTagsActive = vendorFilters === undefined;

    return (
        <Button
            disabled={areAllTagsActive}
            variant="default"
            size={small ? "xs" : undefined}
            leftSection={<FunnelXIcon size={IconSize.SMALL} />}
            onClick={() => {
                setUiState({ vendorFilters: undefined });
            }}
        >
            {text}
        </Button>
    );
}

/**
 * Vendor filter control: an icon button on the header that opens a menu of
 * vendor checkbox items. `undefined` filters mean "all vendors active".
 */
export function VendorMenu(): ReactNode {
    const setUiState = useSetUiState();
    const vendorFilters = useVendorFilters();
    const libraryVendors = getLibraryVendors(useLibraryId());
    const hasFilters = vendorFilters !== undefined;
    // Raw rather than narrowed, so a filter left behind by another library
    // stays clearable even though it is hiding nothing here.
    const hasStoredFilters = useGetUiState().vendorFilters !== undefined;

    const menuItems = (
        <>
            <Menu.Label>Vendors</Menu.Label>
            <Menu.CheckboxGroup
                value={vendorFilters ?? []}
                onChange={(value) => {
                    setUiState({
                        vendorFilters:
                            value.length > 0 ? (value as Vendor[]) : undefined
                    });
                }}
            >
                {libraryVendors.map((vendor) => (
                    <Menu.CheckboxItem key={vendor} value={vendor}>
                        {`${getVendorName(vendor)} (${vendor})`}
                    </Menu.CheckboxItem>
                ))}
            </Menu.CheckboxGroup>
            <Menu.Divider />
            <Menu.Item
                leftSection={<FunnelXIcon size={IconSize.SMALL} />}
                disabled={!hasStoredFilters}
                onClick={() => setUiState({ vendorFilters: undefined })}
            >
                Clear filters
            </Menu.Item>
        </>
    );

    return (
        <AppContextMenu wideMenu menuItems={menuItems} controlledByButton>
            <ActionIcon
                variant={hasFilters ? "light" : "subtle"}
                color={hasFilters ? undefined : "gray"}
                // Match the height of the search input beside it.
                size="input-sm"
                title="Filter vendors"
            >
                <FunnelIcon size={IconSize.CONTROL} />
            </ActionIcon>
        </AppContextMenu>
    );
}
