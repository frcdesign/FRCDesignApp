import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../__test_utils__/render";
import { AppHoverCard } from "./app-hover-card";

function renderInRow() {
    const openRow = vi.fn();
    renderWithProviders(
        <div onClick={openRow}>
            <AppHoverCard target={<span>badge</span>}>card</AppHoverCard>
            <span>elsewhere in the row</span>
        </div>
    );
    return openRow;
}

describe("AppHoverCard", () => {
    // A tap on a phone used to open the card and the row it sits in at once.
    it("opens on a click without the row seeing it", async () => {
        const user = userEvent.setup();
        const openRow = renderInRow();

        await user.click(screen.getByText("badge"));

        expect(screen.queryByText("card")).not.toBeNull();
        expect(openRow).not.toHaveBeenCalled();
    });

    it("keeps a click on the card from the row too", async () => {
        const user = userEvent.setup();
        const openRow = renderInRow();

        await user.click(screen.getByText("badge"));
        await user.click(screen.getByText("card"));

        expect(openRow).not.toHaveBeenCalled();
    });

    // That the dismissing click lands on the overlay rather than a row is
    // layout, which jsdom does not do; it was checked in a touch browser.
    it("closes on a click outside", async () => {
        const user = userEvent.setup();
        renderInRow();

        await user.click(screen.getByText("badge"));
        await user.click(document.body);

        await waitFor(() => {
            expect(screen.queryByText("card")).toBeNull();
        });
    });
});
