import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../__test_utils__/render";

const mocks = vi.hoisted(() => ({
    held: 0,
    approve: vi.fn()
}));

vi.mock("../queries", () => ({
    useAwaitingApprovalCount: () => mocks.held,
    useApproveVersionsMutation: () => ({
        mutate: mocks.approve,
        isPending: false
    })
}));

const { HeldVersionsSetting } = await import("./version-approval");

describe("held versions", () => {
    afterEach(() => mocks.approve.mockReset());

    it("approves the held versions, counting them", async () => {
        mocks.held = 3;
        renderWithProviders(<HeldVersionsSetting />);
        await userEvent.setup().click(screen.getByText("Approve 3"));
        expect(mocks.approve).toHaveBeenCalledOnce();
    });

    it("has nothing to approve with nothing held", () => {
        mocks.held = 0;
        renderWithProviders(<HeldVersionsSetting />);
        expect(screen.getByText("Approve").closest("button")?.disabled).toBe(
            true
        );
    });
});
