import {
    ActionIcon,
    Button,
    Collapse,
    Group,
    Menu,
    Stack,
    TextInput
} from "@mantine/core";
import {
    IconChevronDown,
    IconCircleX,
    IconFilter,
    IconSearch,
    IconSettings
} from "@tabler/icons-react";
import { ReactNode, RefObject, useRef, useState } from "react";

import frcDesignBook from "/frc-design-book.svg";
import { useNavigate } from "@tanstack/react-router";
import { MenuType } from "../overlays/menu-params";
import { VendorFilters } from "./vendor-filters";
import { useUiState } from "../api-utils/ui-state";
import { getLibraryName, useLibrary } from "../api-utils/library";
import { useSaveSettings } from "../api-utils/settings";
import { Library } from "../../shared/types";

/**
 * Provides top-level navigation for the app. A single control row holds the
 * brand, library menu, search, and a filter toggle that reveals the vendor
 * filter row.
 */
export function AppNavbar(): ReactNode {
    const [showFilters, setShowFilters] = useState(false);
    const [uiState] = useUiState();

    return (
        <Stack gap="xs" p="sm">
            <Group justify="space-between" wrap="nowrap" gap="xs">
                <Group gap="xs" wrap="nowrap" style={{ flex: 1 }} miw={0}>
                    <BrandIcon />
                    <LibraryMenu />
                    <SearchBar />
                    <ActionIcon
                        variant={showFilters ? "light" : "subtle"}
                        color={uiState.vendorFilters ? "blue" : "gray"}
                        title="Filters"
                        onClick={() => setShowFilters((show) => !show)}
                    >
                        <IconFilter size={18} />
                    </ActionIcon>
                </Group>
                <SettingsButton />
            </Group>
            <Collapse expanded={showFilters}>
                <VendorFilters />
            </Collapse>
        </Stack>
    );
}

function BrandIcon(): ReactNode {
    return (
        <a href="https://frcdesign.org" target="_blank">
            <img
                src={frcDesignBook}
                alt="FRCDesign.org"
                width={24}
                style={{ display: "block" }}
            />
        </a>
    );
}

function LibraryMenu(): ReactNode {
    const library = useLibrary();
    const saveSettings = useSaveSettings();

    return (
        <Menu position="bottom-start" withinPortal>
            <Menu.Target>
                <Button
                    variant="default"
                    rightSection={<IconChevronDown size={16} />}
                >
                    {getLibraryName(library)}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                {Object.values(Library).map((lib) => (
                    <Menu.Item
                        key={lib}
                        fw={lib === library ? 700 : undefined}
                        onClick={() =>
                            saveSettings(
                                { library: lib },
                                { to: "/app/documents" }
                            )
                        }
                    >
                        {getLibraryName(lib)}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

export function SettingsButton() {
    const navigate = useNavigate();

    return (
        <ActionIcon
            variant="subtle"
            color="gray"
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
