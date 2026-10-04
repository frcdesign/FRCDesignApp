import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toWorkspacePath } from "@backend/features/version-manager/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { VersionForm } from "./version-form";

const ANSWERED = { isPending: false, data: { name: "V5" } };

// The suggestion as the server answers it; the query's own gating isn't under test.
let suggested: { isPending: boolean; data?: { name: string } } = ANSWERED;
vi.mock("../queries", () => ({
    useNextVersionNameQuery: () => suggested
}));

const WORKSPACE = toWorkspacePath("doc", "doc-w");

function form(onSubmit: () => void) {
    return (
        <VersionForm
            versioned={WORKSPACE}
            submitLabel="Push"
            submitIcon={null}
            isPending={false}
            disabled={false}
            onSubmit={onSubmit}
        />
    );
}

function renderForm(onSubmit = vi.fn()) {
    renderWithProviders(form(onSubmit));
    return onSubmit;
}

const nameField = () =>
    screen.getByRole<HTMLInputElement>("textbox", { name: /Version name/ });

beforeEach(() => {
    suggested = ANSWERED;
});

describe("VersionForm", () => {
    it("focuses the suggested name, all of it selected, once it arrives", () => {
        suggested = { isPending: true };
        const { rerender } = renderWithProviders(form(vi.fn()));

        suggested = ANSWERED;
        rerender(form(vi.fn()));

        const name = nameField();
        expect(name.value).toBe("V5");
        expect(document.activeElement).toBe(name);
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

        await user.clear(nameField());

        expect(
            screen.getByRole<HTMLButtonElement>("button", { name: "Push" })
                .disabled
        ).toBe(true);
    });

    it("submits what was typed over the suggestion", async () => {
        const user = userEvent.setup();
        const onSubmit = renderForm();

        await user.keyboard("Release");
        await user.click(screen.getByRole("button", { name: "Push" }));

        expect(onSubmit).toHaveBeenCalledWith({
            name: "Release",
            description: ""
        });
    });
});
