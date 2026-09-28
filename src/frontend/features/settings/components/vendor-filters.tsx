import { ActionIcon, Button, Menu } from "@mantine/core";
import { FunnelIcon, FunnelXIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import {
    getLibraryVendors,
    getVendorName,
    Vendor
} from "@backend/features/library/vendors";
import { getUiState, updateUiState, useUiState } from "../../../lib/ui-state";
import { AppContextMenu } from "../../../components/app-menu";
import { useLibraryId } from "../../../lib/library";
import type { LibraryId } from "@backend/features/library/library-id";

/** The current library's active filters; `undefined` means every vendor. */
export function useVendorFilters(): Vendor[] | undefined {
    const libraryId = useLibraryId();
    return useUiState((state) => state.vendorFilters[libraryId]);
}

/** An empty list is no filter, so it's stored as absent. */
function setVendorFilters(libraryId: LibraryId, vendors: Vendor[]): void {
    // Read at call time, so two changes in a tick don't drop each other.
    const vendorFilters = { ...getUiState().vendorFilters };
    if (vendors.length > 0) {
        vendorFilters[libraryId] = vendors;
    } else {
        delete vendorFilters[libraryId];
    }
    updateUiState({ vendorFilters });
}

function vendorLabel(vendor: Vendor): string {
    const name = getVendorName(vendor);
    return name === vendor ? name : `${name} (${vendor})`;
}

/** Drops the current library's filters, leaving the other libraries' alone. */
export function useClearVendorFilters(): () => void {
    const libraryId = useLibraryId();
    return () => setVendorFilters(libraryId, []);
}

interface ClearFiltersButtonProps {
    /** @default "Clear filters" */
    text?: string;
}

export function ClearFiltersButton(props: ClearFiltersButtonProps): ReactNode {
    const { text = "Clear filters" } = props;
    const clearVendorFilters = useClearVendorFilters();
    const areAllTagsActive = useVendorFilters() === undefined;

    return (
        <Button
            disabled={areAllTagsActive}
            variant="default"
            leftSection={<FunnelXIcon />}
            onClick={clearVendorFilters}
        >
            {text}
        </Button>
    );
}

/** `undefined` filters mean every vendor is active. */
export function VendorMenu(): ReactNode {
    const libraryId = useLibraryId();
    const vendorFilters = useVendorFilters();
    const libraryVendors = getLibraryVendors(libraryId);
    const hasFilters = vendorFilters !== undefined;

    const menuItems = (
        <>
            <Menu.Label>Vendors</Menu.Label>
            <Menu.CheckboxGroup
                value={vendorFilters ?? []}
                onChange={(value) => {
                    setVendorFilters(libraryId, value as Vendor[]);
                }}
            >
                {libraryVendors.map((vendor) => (
                    <Menu.CheckboxItem key={vendor} value={vendor}>
                        {vendorLabel(vendor)}
                    </Menu.CheckboxItem>
                ))}
            </Menu.CheckboxGroup>
            <Menu.Divider />
            <Menu.Item
                leftSection={<FunnelXIcon />}
                disabled={!hasFilters}
                onClick={() => setVendorFilters(libraryId, [])}
            >
                Clear filters
            </Menu.Item>
        </>
    );

    return (
        <AppContextMenu
            wideMenu
            scrollable
            menuItems={menuItems}
            controlledByButton
        >
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
