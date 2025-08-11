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
import { ReactNode, useState } from "react";

import frcDesignBook from "/frc-design-book.svg";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { AppMenu } from "../api/search-params";
import { VendorFilters } from "./vendor-filters";

/**
 * Provides top-level navigation for the app.
 */
export function AppNavbar(): ReactNode {
    const pathname = useLocation().pathname;
    const navigate = useNavigate();

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

    const searchGroup = (
        <ControlGroup>
            <Button
                icon="filter"
                variant={ButtonVariant.MINIMAL}
                onClick={() => setShowFilters(!showFilters)}
                active={showFilters}
                intent={showFilters ? Intent.PRIMARY : Intent.NONE}
            />
            <InputGroup
                type="search"
                leftIcon="search"
                placeholder="Search library..."
                onValueChange={(value) => {
                    const query = value === "" ? undefined : value;
                    navigate({
                        to: pathname,
                        search: { query }
                    });
                }}
            />
        </ControlGroup>
    );

    return (
        <Navbar className="app-navbar">
            {/* Add div to make display: flex work */}
            <div>
                <NavbarGroup>
                    {frcDesignIcon}
                    <NavbarDivider />
                    {searchGroup}
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
    const pathname = useLocation().pathname;
    const navigate = useNavigate();

    return (
        <Button
            icon="cog"
            variant={ButtonVariant.MINIMAL}
            onClick={() =>
                navigate({
                    to: pathname,
                    search: () => ({
                        activeMenu: AppMenu.SETTINGS_MENU
                    })
                })
            }
        />
    );
}
