import { ActionIcon, Collapse, Divider, Group, TextInput } from "@mantine/core";
import {
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

/**
 * Provides top-level navigation for the app.
 */
export function AppNavbar(): ReactNode {
    const [showFilters, setShowFilters] = useState(false);
    const uiState = useUiState()[0];

    const frcDesignIcon = (
        <a href="https://frcdesign.org" target="_blank">
            <img
                src={frcDesignBook}
                alt="FRCDesign.org"
                className="frc-design-icon"
                width={20}
            />
        </a>
    );

    return (
        <div className="app-navbar">
            <Group justify="space-between" px="sm" py="xs" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                    {frcDesignIcon}
                    <Divider orientation="vertical" />
                    <ActionIcon
                        variant={showFilters ? "light" : "subtle"}
                        color={uiState.vendorFilters ? "blue" : "gray"}
                        onClick={() => setShowFilters(!showFilters)}
                        title="Filters"
                    >
                        <IconFilter size={18} />
                    </ActionIcon>
                    <SearchBar />
                </Group>
                <SettingsButton />
            </Group>
            <div
                style={{
                    marginBottom: showFilters ? "10px" : "0px",
                    paddingLeft: "var(--mantine-spacing-sm)",
                    paddingRight: "var(--mantine-spacing-sm)"
                }}
            >
                <Collapse in={showFilters}>
                    <VendorFilters />
                </Collapse>
            </div>
        </div>
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
            type="search"
            leftSection={<IconSearch size={16} />}
            placeholder="Search library..."
            className="search-bar"
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
