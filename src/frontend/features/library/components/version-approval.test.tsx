import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../__test_utils__/render";

const mocks = vi.hoisted(() => ({
    enabled: false,
    held: 0,
    setApproval: vi.fn(),
    approve: vi.fn()
}));

vi.mock("../queries", () => ({
    useVersionApprovalQuery: () => ({
        data: { enabled: mocks.enabled },
        isPending: false
    }),
    useSetVersionApprovalMutation: () => ({
        mutate: mocks.setApproval,
        isPending: false
    }),
    useAwaitingApprovalCount: () => mocks.held,
    useApproveVersionsMutation: () => ({
        mutate: mocks.approve,
        isPending: false
    })
}));

const { ApproveVersionsButton, VersionApprovalSwitch } =
    await import("./version-approval");

describe("version approval", () => {
    afterEach(() => {
        mocks.setApproval.mockReset();
        mocks.approve.mockReset();
    });

    it("turns approval on", async () => {
        mocks.enabled = false;
        renderWithProviders(<VersionApprovalSwitch />);
        await userEvent.setup().click(screen.getByRole("switch"));
        expect(mocks.setApproval).toHaveBeenCalledWith(true);
    });

    it("approves the held versions, counting them", async () => {
        mocks.held = 3;
        renderWithProviders(<ApproveVersionsButton />);
        await userEvent.setup().click(screen.getByText("Approve 3"));
        expect(mocks.approve).toHaveBeenCalledOnce();
    });

    it("has nothing to approve with nothing held", () => {
        mocks.held = 0;
        renderWithProviders(<ApproveVersionsButton />);
        expect(screen.getByText("Approve").closest("button")?.disabled).toBe(
            true
        );
    });
});
