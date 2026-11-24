import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryId } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../__test_utils__/render";
import { UtilityTab } from "../lib/app-tab";
import { getUiState } from "../lib/ui-state";
import { Welcome } from "./welcome";

const { navigateToTab } = vi.hoisted(() => ({ navigateToTab: vi.fn() }));
vi.mock("../lib/tabs", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../lib/tabs")>()),
    useNavigateToTab: () => navigateToTab
}));

afterEach(() => vi.clearAllMocks());

describe("the welcome", () => {
    it("opens the library picked", async () => {
        renderWithProviders(<Welcome />);
        await userEvent.click(screen.getByRole("button", { name: /FTC/ }));

        expect(navigateToTab).toHaveBeenCalledWith(LibraryId.CONFIG_LIB);
        expect(getUiState().tabId).toBe(LibraryId.CONFIG_LIB);
    });

    it("offers every utility, and opens the one picked", async () => {
        renderWithProviders(<Welcome />);
        for (const name of [
            "FeatureScripts",
            "Version Manager",
            "Auto Assembly"
        ]) {
            expect(
                screen.getByRole("button", { name: new RegExp(name) })
            ).toBeDefined();
        }
        await userEvent.click(
            screen.getByRole("button", { name: /Auto Assembly/ })
        );

        expect(navigateToTab).toHaveBeenCalledWith(UtilityTab.AUTO_ASSEMBLY);
        expect(getUiState().tabId).toBe(UtilityTab.AUTO_ASSEMBLY);
    });

    it("does not offer MKCad", () => {
        renderWithProviders(<Welcome />);
        expect(screen.queryByText(/MKCad/)).toBeNull();
    });
});
