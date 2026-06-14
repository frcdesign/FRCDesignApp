import { ActionIcon, Button, Group, Menu, TextInput } from "@mantine/core";
import {
    IconChevronDown,
    IconSearch,
    IconSettings,
    IconX
} from "@tabler/icons-react";
import { IconSize, PRIMARY_COLOR } from "../common/style-constants";
import { ReactNode, RefObject, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

import frcDesignBook from "/frc-design-book.svg";
import { openSettingsMenu } from "../settings/settings-menu";
import { VendorMenu } from "../settings/vendor-filters";
import { useUiState } from "../api-utils/ui-state";
import { getLibraryName, useLibraryId } from "../api-utils/library";
import { useSaveSettings } from "../settings/settings";
import { LibraryId } from "../../shared/types";

/**
 * Provides top-level navigation for the app. A single colored control row holds
 * the brand, library menu, search, vendor filter menu, and settings.
 */
export function AppNavbar(): ReactNode {
    return (
        <Group justify="space-between" wrap="nowrap" gap="xs" p="sm">
            <Group gap="xs" wrap="nowrap" style={{ flex: 1 }} miw={0}>
                <BrandIcon />
                <LibraryMenu />
                <SearchBar />
                <VendorMenu />
            </Group>
            <SettingsButton />
        </Group>
    );
}

function BrandIcon(): ReactNode {
    return (
        <a href="https://frcdesign.org" target="_blank">
            <img
                src={frcDesignBook}
                alt="FRCDesign.org"
                width={24}
                // Render the book in the header's contrast color (white on the
                // colored header) instead of its native gray.
                style={{ display: "block", filter: "brightness(0) invert(1)" }}
            />
        </a>
    );
}

function LibraryMenu(): ReactNode {
    const libraryId = useLibraryId();
    const saveSettings = useSaveSettings();
    const navigate = useNavigate();

    return (
        <Menu position="bottom-start" withinPortal>
            <Menu.Target>
                <Button
                    variant="default"
                    rightSection={<IconChevronDown size={IconSize.SMALL} />}
                >
                    {getLibraryName(libraryId)}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                {Object.values(LibraryId).map((lib) => (
                    <Menu.Item
                        key={lib}
                        onClick={() => {
                            saveSettings({ libraryId: lib });
                            void navigate({ to: "/app/groups" });
                        }}
                    >
                        {getLibraryName(lib)}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

export function SettingsButton() {
    return (
        <ActionIcon
            variant="subtle"
            color={PRIMARY_COLOR}
            title="Settings"
            onClick={() => openSettingsMenu()}
        >
            <IconSettings size={IconSize.MEDIUM} />
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
            size="sm"
            onClick={() => {
                if (ref.current) {
                    ref.current.value = "";
                }
                setUiState({ searchQuery: undefined });
            }}
        >
            <IconX size={IconSize.SMALL} />
        </ActionIcon>
    ) : undefined;

    return (
        <TextInput
            flex={1}
            type="search"
            leftSection={<IconSearch size={IconSize.SMALL} />}
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
