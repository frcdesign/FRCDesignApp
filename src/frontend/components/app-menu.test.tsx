import { describe, expect, it, vi } from "vitest";
import { Menu } from "@mantine/core";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../__test_utils__/render";
import { MenuButton } from "./app-menu";

const dot = () => document.querySelector(".mantine-Indicator-indicator");

function renderButton(isNew?: boolean) {
    const onClose = vi.fn();
    renderWithProviders(
        <MenuButton isNew={isNew} onClose={onClose}>
            <Menu.Item>Item</Menu.Item>
        </MenuButton>
    );
    return onClose;
}

describe("MenuButton", () => {
    it("dots the button while its menu holds something new", () => {
        renderButton(true);
        expect(dot()).not.toBeNull();
    });

    it.each([false, undefined])("has no dot otherwise (%s)", (isNew) => {
        renderButton(isNew);
        expect(dot()).toBeNull();
    });

    it("still opens behind a dot, and says when it closes", async () => {
        const user = userEvent.setup();
        const onClose = renderButton(true);

        await user.click(screen.getByTitle("View options"));
        expect(await screen.findByText("Item")).not.toBeNull();

        await user.keyboard("{Escape}");
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
});
