import { describe, expect, it, vi } from "vitest";
import { Menu } from "@mantine/core";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Favorite } from "@backend/features/favorites/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { ResetConfigurationItems } from "./reset-configuration-items";

function renderItems(favorite?: Favorite) {
    const onReset = vi.fn();
    renderWithProviders(
        <Menu opened>
            <Menu.Target>
                <button>menu</button>
            </Menu.Target>
            <Menu.Dropdown>
                <ResetConfigurationItems
                    favorite={favorite}
                    onReset={onReset}
                />
            </Menu.Dropdown>
        </Menu>
    );
    return onReset;
}

const favorite = (defaultSelection?: Record<string, string>): Favorite => ({
    id: "fav",
    insertableId: "ins",
    libraryId: LibraryId.FRC_DESIGN_LIB,
    defaultSelection
});

describe("resetting the configuration", () => {
    it("goes back to the element's defaults", async () => {
        const user = userEvent.setup();
        const onReset = renderItems();

        await user.click(screen.getByText("Reset to defaults"));

        expect(onReset).toHaveBeenCalledWith({});
    });

    it("goes back to what the favorite opens with", async () => {
        const user = userEvent.setup();
        const onReset = renderItems(favorite({ size: "large" }));

        await user.click(screen.getByText("Reset to favorite configuration"));

        expect(onReset).toHaveBeenCalledWith({ size: "large" });
    });

    it("offers no favorite reset where the favorite is the defaults", () => {
        renderItems(favorite());
        expect(
            screen.queryByText("Reset to favorite configuration")
        ).toBeNull();
    });
});
