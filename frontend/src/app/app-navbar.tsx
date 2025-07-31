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
    NavbarGroup,
    Tag
} from "@blueprintjs/core";
import { ReactNode, useState } from "react";

import frcDesignBook from "/frc-design-book.svg";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { AppDialog } from "../api/search-params";
import { getVendorName, Vendor } from "../api/backend-types";

/**
 * Provides top-level navigation for the app.
 */
export function AppNavbar(): ReactNode {
    const pathname = useLocation().pathname;
    const navigate = useNavigate();

    const [showFilters, setShowFilters] = useState(false);
    const search = useSearch({ from: "/app" });
    const vendors = search.vendors ?? [];

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

    const filterTags = Object.values(Vendor).map((vendor) => {
        return (
            <Tag
                round
                interactive
                key={vendor}
                intent={Intent.PRIMARY}
                title={getVendorName(vendor)}
                onClick={() => {
                    const newVendors = [...vendors, vendor];
                    navigate({ to: pathname, search: { vendors: newVendors } });
                }}
                active={
                    vendors.length === 0
                        ? false
                        : !vendors.find((curr) => curr === vendor)
                }
            >
                {vendor}
            </Tag>
        );
    });

    const clearButton = (
        <Button
            text="Clear"
            disabled={vendors.length === 0}
            variant={ButtonVariant.OUTLINED}
            icon="small-cross"
            onClick={() => {
                navigate({ to: pathname, search: { vendors: [] } });
            }}
        />
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
                    <Button
                        icon="cog"
                        variant={ButtonVariant.MINIMAL}
                        onClick={() =>
                            navigate({
                                to: pathname,
                                search: () => ({
                                    activeDialog: AppDialog.ADMIN_PANEL
                                })
                            })
                        }
                    />
                </NavbarGroup>
            </div>
            <div style={{ marginBottom: showFilters ? "10px" : "0px" }}>
                <Collapse isOpen={showFilters}>
                    <div className="split" style={{ gap: "5x" }}>
                        <div
                            style={{
                                display: "flex",
                                gap: "5px",
                                flexWrap: "wrap"
                            }}
                        >
                            {filterTags}
                        </div>
                        {clearButton}
                    </div>
                </Collapse>
            </div>
        </Navbar>
    );
}
