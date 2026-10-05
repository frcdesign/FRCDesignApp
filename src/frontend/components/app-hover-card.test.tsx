import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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

const pause = (ms: number) =>
    act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/** A tap as Chrome sends it: the touch, then the mouse events it stands for. */
function tap(element: Element) {
    fireEvent.pointerDown(element, { pointerType: "touch" });
    fireEvent.pointerUp(element, { pointerType: "touch" });
    fireEvent.mouseEnter(element);
    fireEvent.click(element);
    fireEvent.mouseLeave(element);
}

/** The element the card listens on, which wraps the target it was given. */
const badge = () => screen.getByText("badge").parentElement!;

describe("AppHoverCard on a touchscreen", () => {
    it("opens on a tap without the row seeing it, and stays open", async () => {
        const openRow = renderInRow();

        tap(badge());
        await pause(300);

        expect(screen.queryByText("card")).not.toBeNull();
        expect(openRow).not.toHaveBeenCalled();
    });

    it("keeps a tap on the card from the row", async () => {
        const openRow = renderInRow();

        tap(badge());
        await pause(0);
        tap(screen.getByText("card"));

        expect(openRow).not.toHaveBeenCalled();
    });

    it("closes on a tap outside, without the tap reaching the row", async () => {
        const openRow = renderInRow();
        tap(badge());
        await pause(0);

        tap(screen.getByText("elsewhere in the row"));

        await waitFor(() => {
            expect(screen.queryByText("card")).toBeNull();
        });
        expect(openRow).not.toHaveBeenCalled();

        tap(screen.getByText("elsewhere in the row"));
        expect(openRow).toHaveBeenCalledOnce();
    });
});

describe("AppHoverCard with a mouse", () => {
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

    it("lets a click outside through", async () => {
        const user = userEvent.setup();
        const openRow = renderInRow();
        await user.hover(screen.getByText("badge"));
        expect(await screen.findByText("card")).not.toBeNull();

        await user.click(screen.getByText("elsewhere in the row"));

        expect(openRow).toHaveBeenCalledOnce();
    });
});
