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
import { ReactNode, useRef, useState } from "react";

import frcDesignBook from "/frc-design-book.svg";
import { useNavigate } from "@tanstack/react-router";
import { AppMenu } from "../api/menu-params";
import { VendorFilters } from "./vendor-filters";

/**
 * Provides top-level navigation for the app.
 */
export function AppNavbar(): ReactNode {
    const [showFilters, setShowFilters] = useState(false);

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
                            intent={showFilters ? Intent.PRIMARY : Intent.NONE}
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

export function SearchBar() {
    const navigate = useNavigate();
    const ref = useRef<HTMLInputElement>(null);

    return (
        <InputGroup
            type="search"
            leftIcon="search"
            placeholder="Search library..."
            inputRef={ref}
            onFocus={() => {
                const input = ref.current;
                if (!input) {
                    return;
                }
                const length = input.value.length;
                input.setSelectionRange(0, length);
            }}
            onValueChange={(value) => {
                const query = value === "" ? undefined : value;
                navigate({
                    to: ".",
                    search: { query }
                });
            }}
        />
    );
}
