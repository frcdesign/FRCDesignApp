import { describe, expect, it, vi } from "vitest";
import { ModalsProvider } from "@mantine/modals";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../__test_utils__/render";
import { openDeleteConfirm } from "./alerts";

function ask() {
    const onConfirm = vi.fn();
    renderWithProviders(
        <ModalsProvider>
            <button
                onClick={() =>
                    openDeleteConfirm({
                        title: "Remove link",
                        text: "Are you sure you want to delete the link to Gearbox?",
                        confirmLabel: "Remove link",
                        onConfirm
                    })
                }
            >
                ask
            </button>
        </ModalsProvider>
    );
    return onConfirm;
}

describe("openDeleteConfirm", () => {
    it("deletes once confirmed", async () => {
        const user = userEvent.setup();
        const onConfirm = ask();

        await user.click(screen.getByText("ask"));
        expect(
            screen.getByText(
                "Are you sure you want to delete the link to Gearbox?"
            )
        ).not.toBeNull();
        await user.click(screen.getByRole("button", { name: "Remove link" }));

        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("deletes nothing when cancelled", async () => {
        const user = userEvent.setup();
        const onConfirm = ask();

        await user.click(screen.getByText("ask"));
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        await waitFor(() =>
            expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
        );
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
