import { ActionIcon, Button, Menu } from "@mantine/core";
import { Funnel, FunnelX } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import { getVendorName } from "@backend/features/library/vendors";
import { Vendor } from "@backend/features/library/vendors";
import { useUiState } from "../../../lib/ui-state";
import { AppContextMenu } from "../../../components/app-menu";

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
            disabled={areAllTagsActive}
            variant="default"
            size={small ? "xs" : undefined}
            leftSection={<FunnelX size={IconSize.SMALL} />}
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
    const [uiState, setUiState] = useUiState();
    const hasFilters = uiState.vendorFilters !== undefined;

    const menuItems = (
        <>
            <Menu.Label>Vendors</Menu.Label>
            <Menu.CheckboxGroup
                value={uiState.vendorFilters ?? []}
                onChange={(value) => {
                    setUiState({
                        vendorFilters:
                            value.length > 0 ? (value as Vendor[]) : undefined
                    });
                }}
            >
                {Object.values(Vendor).map((vendor) => (
                    <Menu.CheckboxItem key={vendor} value={vendor}>
                        {`${getVendorName(vendor)} (${vendor})`}
                    </Menu.CheckboxItem>
                ))}
            </Menu.CheckboxGroup>
            <Menu.Divider />
            <Menu.Item
                leftSection={<FunnelX size={IconSize.SMALL} />}
                disabled={!hasFilters}
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
                <Funnel size={IconSize.CONTROL} />
            </ActionIcon>
        </AppContextMenu>
    );
}
