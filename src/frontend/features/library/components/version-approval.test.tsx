import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../__test_utils__/render";

const mocks = vi.hoisted(() => ({
    held: 0,
    approve: vi.fn(),
    hold: undefined as boolean | undefined,
    setHold: vi.fn()
}));

vi.mock("../queries", () => ({
    useApproveVersionsMutation: () => ({
        mutate: mocks.approve,
        isPending: false
    }),
    useHoldNewVersionsQuery: () => ({
        data:
            mocks.hold === undefined
                ? undefined
                : { holdNewVersions: mocks.hold },
        isPending: mocks.hold === undefined
    }),
    useSetHoldNewVersionsMutation: () => ({ mutate: mocks.setHold })
}));

vi.mock("../../build-status/queries", () => ({
    useHeldGroupCount: () => mocks.held
}));

const { HeldVersionsSetting, HoldNewVersionsSetting } =
    await import("./version-approval");

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

describe("holding new versions", () => {
    afterEach(() => mocks.setHold.mockReset());

    const toggle = () =>
        screen.getByRole<HTMLInputElement>("switch", {
            name: "Hold new versions"
        });

    it("turns holding off", async () => {
        mocks.hold = true;
        renderWithProviders(<HoldNewVersionsSetting />);
        expect(toggle().checked).toBe(true);

        await userEvent.setup().click(toggle());

        expect(mocks.setHold).toHaveBeenCalledWith(false);
    });

    it("shows a library that loads new versions at once", () => {
        mocks.hold = false;
        renderWithProviders(<HoldNewVersionsSetting />);
        expect(toggle().checked).toBe(false);
    });
});
