import { describe, expect, it, vi } from "vitest";
import { Menu } from "@mantine/core";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../__test_utils__/render";
import { ChangeOrderItems } from "./change-order";

const ORDER = ["a", "b", "c", "d"];

function renderItems(id: string, order = ORDER) {
    const onOrderChange = vi.fn();
    renderWithProviders(
        <Menu opened>
            <Menu.Target>
                <button>menu</button>
            </Menu.Target>
            <Menu.Dropdown>
                <ChangeOrderItems
                    id={id}
                    order={order}
                    onOrderChange={onOrderChange}
                />
            </Menu.Dropdown>
        </Menu>
    );
    return onOrderChange;
}

const shownItems = () =>
    screen.queryAllByRole("menuitem").map((item) => item.textContent);

describe("ChangeOrderItems", () => {
    it.each([
        ["a", ["Move down", "Move to bottom"]],
        // One from an end, the double move would repeat the single one.
        ["b", ["Move up", "Move down", "Move to bottom"]],
        ["c", ["Move up", "Move down", "Move to top"]],
        ["d", ["Move up", "Move to top"]]
    ])("offers %s only the moves that change something", (id, items) => {
        renderItems(id);
        expect(shownItems()).toEqual(items);
    });

    it("offers nothing for a lone item", () => {
        renderItems("a", ["a"]);
        expect(shownItems()).toEqual([]);
    });

    it("offers nothing for an id not in the list", () => {
        renderItems("z");
        expect(shownItems()).toEqual([]);
    });

    it.each([
        ["Move up", "c", ["a", "c", "b", "d"]],
        ["Move down", "b", ["a", "c", "b", "d"]],
        ["Move to top", "c", ["c", "a", "b", "d"]],
        ["Move to bottom", "b", ["a", "c", "d", "b"]]
    ])("%s moves %s", async (label, id, expected) => {
        const user = userEvent.setup();
        const onOrderChange = renderItems(id);

        await user.click(screen.getByText(label));

        expect(onOrderChange).toHaveBeenCalledWith(expected);
    });

    it("leaves the order it was given alone", async () => {
        const user = userEvent.setup();
        const order = [...ORDER];
        renderItems("d", order);

        await user.click(screen.getByText("Move to top"));

        expect(order).toEqual(ORDER);
    });
});
