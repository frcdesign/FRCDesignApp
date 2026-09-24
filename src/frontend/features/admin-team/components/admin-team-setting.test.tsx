import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessLevel } from "@backend/features/auth/access-level";
import { renderWithProviders } from "../../../../__test_utils__/render";

const mocks = vi.hoisted(() => ({
    level: "owner",
    mutate: vi.fn()
}));

vi.mock("../../auth/access-level", () => ({
    useAccessData: () => ({ currentAccessLevel: mocks.level })
}));
vi.mock("../queries", () => ({
    useAdminTeamQuery: () => ({
        data: { teamId: "team-1", memberCount: 2 },
        isPending: false
    }),
    useSetAdminTeamMutation: () => ({ mutate: mocks.mutate, isPending: false })
}));

const { AdminTeamSetting } = await import("./admin-team-setting");

describe("the admin team setting", () => {
    afterEach(() => mocks.mutate.mockReset());

    it("saves what the owner types once they leave the field", async () => {
        mocks.level = AccessLevel.OWNER;
        const user = userEvent.setup();
        renderWithProviders(<AdminTeamSetting />);

        const field = screen.getByLabelText("Admin team id");
        await user.clear(field);
        await user.type(field, " team-2 {Enter}");

        expect(mocks.mutate).toHaveBeenCalledWith("team-2");
    });

    it("clears the team when the owner empties the field", async () => {
        mocks.level = AccessLevel.OWNER;
        const user = userEvent.setup();
        renderWithProviders(<AdminTeamSetting />);

        await user.clear(screen.getByLabelText("Admin team id"));
        await user.tab();

        expect(mocks.mutate).toHaveBeenCalledWith(null);
    });

    it("saves nothing when the team did not change", async () => {
        mocks.level = AccessLevel.OWNER;
        const user = userEvent.setup();
        renderWithProviders(<AdminTeamSetting />);

        await user.click(screen.getByLabelText("Admin team id"));
        await user.tab();

        expect(mocks.mutate).not.toHaveBeenCalled();
    });

    it("shows the team to anyone else without letting them change it", () => {
        mocks.level = AccessLevel.ADMIN;
        renderWithProviders(<AdminTeamSetting />);

        const field = screen.getByLabelText("Admin team id");
        expect((field as HTMLInputElement).value).toBe("team-1");
        expect(field).toHaveProperty("readOnly", true);
    });
});
