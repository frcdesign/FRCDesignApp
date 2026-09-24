import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Favorite } from "@backend/features/favorites/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../../../__test_utils__/render";
import type { SelectionReport } from "../../insert/components/configurations";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("../queries", () => ({
    useSetDefaultConfigurationMutation: () => ({ mutate, isPending: false })
}));

const { SaveFavoriteConfigurationButton } =
    await import("./save-favorite-configuration-button");

const FAVORITE: Favorite = {
    id: "fav",
    insertableId: "ins",
    libraryId: LibraryId.FRC_DESIGN_LIB,
    defaultSelection: { size: "small", length: "1 in" }
};

function report(selection: Record<string, string>): SelectionReport {
    return {
        // A derivation variable rides along, but the favorite never keeps one.
        selection: { ...selection, dv: "uuid" },
        stored: selection,
        overrides: {},
        configurationKey: "key",
        record: undefined
    };
}

describe("saving the favorite's configuration", () => {
    afterEach(() => mutate.mockReset());

    it("saves the configuration on screen", async () => {
        const user = userEvent.setup();
        const onScreen = report({ size: "large", length: "1 in" });
        renderWithProviders(
            <SaveFavoriteConfigurationButton
                favorite={FAVORITE}
                report={onScreen}
                configurationKey="key"
            />
        );

        await user.click(screen.getByRole("button"));

        expect(mutate).toHaveBeenCalledWith({
            selection: onScreen.selection,
            configurationKey: "key"
        });
    });

    it("has nothing to save when the favorite already opens with it", () => {
        renderWithProviders(
            <SaveFavoriteConfigurationButton
                favorite={FAVORITE}
                report={report({ size: "small", length: "1 in" })}
                configurationKey="key"
            />
        );

        expect(screen.getByRole("button")).toHaveProperty("disabled", true);
    });

    // Saved as entered, so a different spelling of the same size still saves.
    it("saves an expression that spells the saved value differently", () => {
        renderWithProviders(
            <SaveFavoriteConfigurationButton
                favorite={FAVORITE}
                report={report({ size: "small", length: "(0.5 + 0.5) in" })}
                configurationKey="key"
            />
        );

        expect(screen.getByRole("button")).toHaveProperty("disabled", false);
    });

    it("counts a favorite with no selection as saved on the defaults", () => {
        renderWithProviders(
            <SaveFavoriteConfigurationButton
                favorite={{ ...FAVORITE, defaultSelection: undefined }}
                report={report({ size: "small", length: "1 in" })}
                configurationKey=""
            />
        );

        expect(screen.getByRole("button")).toHaveProperty("disabled", true);
    });
});
