import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("AppHoverCard on a touchscreen", () => {
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

describe("AppHoverCard with a mouse", () => {
    beforeEach(() => {
        vi.spyOn(window, "matchMedia").mockImplementation(
            (query) =>
                ({
                    matches: query === "(hover: hover)",
                    media: query,
                    addEventListener: () => undefined,
                    removeEventListener: () => undefined
                }) as unknown as MediaQueryList
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("opens on hover and closes when the pointer leaves", async () => {
        const user = userEvent.setup();
        renderInRow();

        await user.hover(screen.getByText("badge"));
        expect(await screen.findByText("card")).not.toBeNull();

        await user.unhover(screen.getByText("badge"));
        await waitFor(() => {
            expect(screen.queryByText("card")).toBeNull();
        });
    });

    it("keeps a click on the target from the row", async () => {
        const user = userEvent.setup();
        const openRow = renderInRow();

        await user.click(screen.getByText("badge"));

        expect(openRow).not.toHaveBeenCalled();
    });
});
