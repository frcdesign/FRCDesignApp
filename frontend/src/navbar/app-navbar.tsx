import {
    Alignment,
    Button,
    ButtonVariant,
    Collapse,
    ControlGroup,
    IconSize,
    InputGroup,
    Intent,
    Navbar,
    NavbarDivider,
    NavbarGroup
} from "@blueprintjs/core";
import { ReactNode, RefObject, useRef, useState } from "react";

import frcDesignBook from "/frc-design-book.svg";
import { useNavigate } from "@tanstack/react-router";
import { AppMenu } from "../api/menu-params";
import { VendorFilters } from "./vendor-filters";
import { useUiState } from "../api/ui-state";

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
                width={IconSize.LARGE}
            />
        </a>
    );

    return (
        <Navbar className="app-navbar">
            {/* Add div to make display: flex work */}
            <div>
                <NavbarGroup>
                    {frcDesignIcon}
                    <NavbarDivider />
                    <ControlGroup>
                        <Button
                            icon="filter"
                            variant={ButtonVariant.MINIMAL}
                            onClick={() => setShowFilters(!showFilters)}
                            active={showFilters}
                            intent={
                                uiState.vendorFilters
                                    ? Intent.PRIMARY
                                    : Intent.NONE
                            }
                        />
                        <SearchBar />
                    </ControlGroup>
                </NavbarGroup>
                <NavbarGroup align={Alignment.END}>
                    <SettingsButton />
                </NavbarGroup>
            </div>
            <div style={{ marginBottom: showFilters ? "10px" : "0px" }}>
                <Collapse isOpen={showFilters}>
                    <VendorFilters />
                </Collapse>
            </div>
        </Navbar>
    );
}

export function SettingsButton() {
    const navigate = useNavigate();

    return (
        <Button
            icon="cog"
            variant={ButtonVariant.MINIMAL}
            onClick={() =>
                navigate({
                    to: ".",
                    search: () => ({
                        activeMenu: AppMenu.SETTINGS_MENU
                    })
                })
            }
        />
    );
}

function selectAllInputText(ref: RefObject<HTMLInputElement>) {
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

    return (
        <InputGroup
            type="search"
            leftIcon="search"
            placeholder="Search library..."
            inputRef={ref}
            value={uiState.searchQuery}
            onFocus={() => {
                selectAllInputText(ref);
            }}
            onValueChange={(value) => {
                const query = value === "" ? undefined : value;
                setUiState({ searchQuery: query });
            }}
        />
    );
}
