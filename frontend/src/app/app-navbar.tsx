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
import { useLocation, useNavigate } from "@tanstack/react-router";

/**
 * Provides top-level navigation for the app.
 */
export function AppNavbar(): ReactNode {
    const navigate = useNavigate();
    const currentPath = useLocation().pathname;

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
            />
        </ControlGroup>
    );

    const filterTags = [
        "REV",
        "West Coast Products",
        "The Thrifty Bot",
        "AndyMark"
    ].map((vendor) => {
        return (
            <Tag round interactive key={vendor} intent={Intent.PRIMARY}>
                {vendor}
            </Tag>
        );
    });

    const clearButton = (
        <Button
            text="Clear"
            disabled
            variant={ButtonVariant.OUTLINED}
            icon="small-cross"
        />
    );

    return (
        <Navbar
            style={{
                display: "flex",
                flexDirection: "column",
                height: "unset"
            }}
        >
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
                                to: currentPath + "/admin"
                            })
                        }
                    />
                </NavbarGroup>
            </div>
            <div style={{ marginBottom: showFilters ? "10px" : "0px" }}>
                <Collapse isOpen={showFilters}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}
                    >
                        <div style={{ display: "flex", gap: "5px" }}>
                            {filterTags}
                        </div>
                        {clearButton}
                    </div>
                </Collapse>
            </div>
        </Navbar>
    );
}
