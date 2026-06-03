import { ActionIcon, Group, Stack, TextInput, ThemeIcon } from "@mantine/core";
import { IconCircleX, IconSearch, IconSettings } from "@tabler/icons-react";
import { ReactNode, RefObject, useRef } from "react";

import frcDesignBook from "/frc-design-book.svg";
import { useNavigate } from "@tanstack/react-router";
import { MenuType } from "../overlays/menu-params";
import { VendorFilters } from "./vendor-filters";
import { useUiState } from "../api-utils/ui-state";

/** Foreground color for controls on the colored header. */
const ON_PRIMARY = "var(--mantine-primary-color-contrast)";

/**
 * Provides top-level navigation for the app. Rendered inside a colored
 * AppShell.Header; the vendor filters are always visible.
 */
export function AppNavbar(): ReactNode {
    return (
        <Stack gap="xs" p="sm">
            <Group justify="space-between" wrap="nowrap">
                <BrandIcon />
                <SearchBar />
                <SettingsButton />
            </Group>
            <VendorFilters />
        </Stack>
    );
}

function BrandIcon(): ReactNode {
    return (
        <a href="https://frcdesign.org" target="_blank">
            <ThemeIcon variant="white" size="lg" radius="sm">
                <img src={frcDesignBook} alt="FRCDesign.org" width={20} />
            </ThemeIcon>
        </a>
    );
}

export function SettingsButton() {
    const navigate = useNavigate();

    return (
        <ActionIcon
            variant="subtle"
            color={ON_PRIMARY}
            title="Settings"
            onClick={() =>
                void navigate({
                    to: ".",
                    search: () => ({
                        activeMenu: MenuType.SETTINGS_MENU
                    })
                })
            }
        >
            <IconSettings size={18} />
        </ActionIcon>
    );
}

function selectAllInputText(ref: RefObject<HTMLInputElement | null>) {
    const input = ref.current;
    if (!input) {
        return;
    }
    const length = input.value.length;
    input.setSelectionRange(0, length);
}

export function SearchBar() {
    const ref = useRef<HTMLInputElement>(null);
    const [uiState, setUiState] = useUiState();

    const clearButton = uiState.searchQuery ? (
        <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => {
                if (ref.current) {
                    ref.current.value = "";
                }
                setUiState({ searchQuery: undefined });
            }}
        >
            <IconCircleX size={16} />
        </ActionIcon>
    ) : undefined;

    return (
        <TextInput
            flex={1}
            type="search"
            leftSection={<IconSearch size={16} />}
            placeholder="Search library..."
            ref={ref}
            value={uiState.searchQuery ?? ""}
            onFocus={() => {
                selectAllInputText(ref);
            }}
            onChange={(event) => {
                const value = event.currentTarget.value;
                const query = value === "" ? undefined : value;
                setUiState({ searchQuery: query });
            }}
            rightSection={clearButton}
        />
    );
}
