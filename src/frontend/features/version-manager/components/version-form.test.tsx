import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toWorkspacePath } from "@backend/features/version-manager/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { VersionForm } from "./version-form";

// The suggestion as the server answers it; the query's own gating isn't under test.
vi.mock("../queries", () => ({
    useNextVersionNameQuery: () => ({ isPending: false, data: { name: "V5" } })
}));

const WORKSPACE = toWorkspacePath("doc", "doc-w");

function renderForm(onSubmit = vi.fn()) {
    renderWithProviders(
        <VersionForm
            versioned={WORKSPACE}
            submitLabel="Push"
            submitIcon={null}
            isPending={false}
            disabled={false}
            onSubmit={onSubmit}
        />
    );
    return onSubmit;
}

describe("VersionForm", () => {
    it("opens with the suggested name as text, all of it selected on a click", async () => {
        const user = userEvent.setup();
        renderForm();

        const name = screen.getByRole<HTMLInputElement>("textbox", {
            name: /Version name/
        });
        expect(name.value).toBe("V5");
        await user.click(name);
        expect([name.selectionStart, name.selectionEnd]).toEqual([0, 2]);
    });

    // Each document a run versions is then numbered from its own history.
    it("submits no name while the suggestion is untouched", async () => {
        const user = userEvent.setup();
        const onSubmit = renderForm();

        await user.click(screen.getByRole("button", { name: "Push" }));

        expect(onSubmit).toHaveBeenCalledWith({
            name: undefined,
            description: ""
        });
    });

    it("can't be submitted without a name", async () => {
        const user = userEvent.setup();
        renderForm();

        await user.clear(screen.getByRole("textbox", { name: /Version name/ }));

        expect(
            screen.getByRole<HTMLButtonElement>("button", { name: "Push" })
                .disabled
        ).toBe(true);
    });

    it("submits what was typed over the suggestion", async () => {
        const user = userEvent.setup();
        const onSubmit = renderForm();

        await user.click(screen.getByRole("textbox", { name: /Version name/ }));
        await user.keyboard("Release");
        await user.click(screen.getByRole("button", { name: "Push" }));

        expect(onSubmit).toHaveBeenCalledWith({
            name: "Release",
            description: ""
        });
    });
});
