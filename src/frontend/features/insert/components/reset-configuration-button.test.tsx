import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Favorite } from "@backend/features/favorites/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../../../__test_utils__/render";
import type { SelectionReport } from "./configurations";
import { ResetConfigurationButton } from "./reset-configuration-button";

function report(
    stored: Record<string, string>,
    overrides: Record<string, string> = {}
): SelectionReport {
    return {
        selection: stored,
        stored,
        overrides,
        configurationKey: "key",
        record: undefined
    };
}

const FAVORITE: Favorite = {
    id: "fav",
    insertableId: "ins",
    libraryId: LibraryId.FRC_DESIGN_LIB,
    defaultSelection: { size: "large" }
};

function renderButton(
    favorite: Favorite | undefined,
    onScreen: SelectionReport | undefined
) {
    const onReset = vi.fn();
    renderWithProviders(
        <ResetConfigurationButton
            favorite={favorite}
            report={onScreen}
            onReset={onReset}
        />
    );
    return { onReset, button: screen.getByRole("button") };
}

describe("resetting the configuration", () => {
    it("goes back to the element's defaults", async () => {
        const user = userEvent.setup();
        const { onReset, button } = renderButton(
            undefined,
            report({ size: "large" }, { size: "large" })
        );

        await user.click(button);

        expect(onReset).toHaveBeenCalledWith({});
    });

    it("goes back to what the favorite opens with", async () => {
        const user = userEvent.setup();
        const { onReset, button } = renderButton(
            FAVORITE,
            report({ size: "small" })
        );

        await user.click(button);

        expect(onReset).toHaveBeenCalledWith({ size: "large" });
    });

    it("is off on the element's defaults", () => {
        const { button } = renderButton(undefined, report({ size: "small" }));
        expect(button).toHaveProperty("disabled", true);
    });

    // The favorite's configuration is the default, not the element's.
    it("is off on the favorite's configuration, though it overrides the element's", () => {
        const { button } = renderButton(
            FAVORITE,
            report({ size: "large" }, { size: "large" })
        );
        expect(button).toHaveProperty("disabled", true);
    });

    it("is off until the panel settles", () => {
        const { button } = renderButton(FAVORITE, undefined);
        expect(button).toHaveProperty("disabled", true);
    });
});
