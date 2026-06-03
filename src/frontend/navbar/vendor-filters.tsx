import { Button, Checkbox, Group } from "@mantine/core";
import { IconFilterOff } from "@tabler/icons-react";
import { ReactNode } from "react";
import { getVendorName } from "../../shared/types";
import { Vendor } from "../../shared/types";
import { useUiState } from "../api-utils/ui-state";

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

export function VendorFilters(): ReactNode {
    const [uiState, setUiState] = useUiState();

    // `undefined` means "all vendors active" (no filtering); the checkbox group
    // works on a plain array, so map an empty selection back to `undefined`.
    const vendorFilters = uiState.vendorFilters ?? [];

    return (
        <Group justify="space-between" align="flex-end" gap="xs" wrap="nowrap">
            <Checkbox.Group
                value={vendorFilters}
                onChange={(value) => {
                    setUiState({
                        vendorFilters: value.length > 0 ? value : undefined
                    });
                }}
            >
                <Group gap="sm">
                    {Object.values(Vendor).map((vendor) => (
                        <Checkbox
                            key={vendor}
                            value={vendor}
                            size="xs"
                            label={`${getVendorName(vendor)} (${vendor})`}
                        />
                    ))}
                </Group>
            </Checkbox.Group>
            <ClearFiltersButton text="Clear" small />
        </Group>
    );
}
