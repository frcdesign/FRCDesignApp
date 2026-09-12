import { ActionIcon, Button, Menu } from "@mantine/core";
import { FunnelIcon, FunnelXIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import {
    getLibraryVendors,
    getVendorName,
    Vendor
} from "@backend/features/library/vendors";
import {
    getUiState,
    updateUiState,
    useGetUiState
} from "../../../lib/ui-state";
import { AppContextMenu } from "../../../components/app-menu";
import { useLibraryId } from "../../../lib/library";
import type { LibraryId } from "@backend/features/library/library-id";

/** The current library's active filters; `undefined` means every vendor. */
export function useVendorFilters(): Vendor[] | undefined {
    const uiState = useGetUiState();
    const libraryId = useLibraryId();
    return uiState.vendorFilters[libraryId];
}

/** Replaces one library's filters, leaving what the others have picked. An
 * empty list is no filter at all, so it is stored as absent. */
function setVendorFilters(libraryId: LibraryId, vendors: Vendor[]): void {
    // Read at call time rather than from a render, so two changes in a tick
    // cannot drop one another's library.
    const vendorFilters = { ...getUiState().vendorFilters };
    if (vendors.length > 0) {
        vendorFilters[libraryId] = vendors;
    } else {
        delete vendorFilters[libraryId];
    }
    updateUiState({ vendorFilters });
}

/** A vendor's name, and the code a part number writes it as when that differs
 * — Custom names itself, so it does not repeat. */
function vendorLabel(vendor: Vendor): string {
    const name = getVendorName(vendor);
    return name === vendor ? name : `${name} (${vendor})`;
}

interface ClearFiltersButtonProps {
    /** @default "Clear filters" */
    text?: string;
    /** @default false */
    small?: boolean;
}

export function ClearFiltersButton(props: ClearFiltersButtonProps): ReactNode {
    const { text = "Clear filters", small = false } = props;
    const libraryId = useLibraryId();
    const areAllTagsActive = useVendorFilters() === undefined;

    return (
        <Button
            disabled={areAllTagsActive}
            variant="default"
            size={small ? "xs" : undefined}
            leftSection={<FunnelXIcon size={IconSize.SMALL} />}
            onClick={() => {
                setVendorFilters(libraryId, []);
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
                leftSection={<FunnelXIcon size={IconSize.SMALL} />}
                disabled={!hasFilters}
                onClick={() => setVendorFilters(libraryId, [])}
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
