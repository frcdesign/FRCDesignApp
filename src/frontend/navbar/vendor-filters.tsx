import { ActionIcon, Button, Menu } from "@mantine/core";
import { IconFilter, IconFilterOff } from "@tabler/icons-react";
import { ReactNode } from "react";
import { getVendorName } from "../../shared/types";
import { Vendor } from "../../shared/types";
import { useUiState } from "../api-utils/ui-state";

/** Foreground color for controls on the colored header. */
const ON_PRIMARY = "var(--mantine-primary-color-contrast)";

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
            leftSection={<IconFilterOff size={16} />}
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

    return (
        <Menu
            position="bottom-end"
            closeOnItemClick={false}
            withinPortal
            width={240}
        >
            <Menu.Target>
                <ActionIcon
                    variant={hasFilters ? "light" : "subtle"}
                    color={ON_PRIMARY}
                    title="Filter vendors"
                >
                    <IconFilter size={18} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>Vendors</Menu.Label>
                <Menu.CheckboxGroup
                    value={uiState.vendorFilters ?? []}
                    onChange={(value) => {
                        setUiState({
                            vendorFilters:
                                value.length > 0
                                    ? (value as Vendor[])
                                    : undefined
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
                    leftSection={<IconFilterOff size={16} />}
                    disabled={!hasFilters}
                    onClick={() => setUiState({ vendorFilters: undefined })}
                >
                    Clear filters
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
}
