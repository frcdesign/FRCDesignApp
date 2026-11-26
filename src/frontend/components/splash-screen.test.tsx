import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryId } from "@backend/features/library/library-id";
import { Hint } from "@backend/features/hints/contract";
import { renderWithProviders } from "../../__test_utils__/render";
import { apiPost } from "../lib/api-client";
import { UtilityTab } from "../lib/app-tab";
import { getUiState, updateUiState } from "../lib/ui-state";
import { SplashScreen } from "./splash-screen";

const { navigateToTab, access } = vi.hoisted(() => ({
    navigateToTab: vi.fn(),
    access: {
        seenHints: [] as string[],
        signedIn: true,
        isPending: false
    }
}));
vi.mock("../lib/tabs", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../lib/tabs")>()),
    useNavigateToTab: () => navigateToTab
}));
vi.mock("../features/auth/access-level", () => ({
    useAccessData: () => access
}));
vi.mock("../lib/api-client", () => ({
    apiPost: vi.fn(() => Promise.resolve({}))
}));

beforeEach(() => {
    access.seenHints = [];
    access.signedIn = true;
    access.isPending = false;
});
afterEach(() => vi.clearAllMocks());

const TITLE = "Welcome to the FRCDesignApp!";

describe("the splash screen", () => {
    it("opens the library picked, and is seen everywhere", async () => {
        renderWithProviders(<SplashScreen />);
        await userEvent.click(
            screen.getByRole("button", { name: /ConfigLib/ })
        );

        expect(navigateToTab).toHaveBeenCalledWith(LibraryId.CONFIG_LIB);
        expect(getUiState().tabId).toBe(LibraryId.CONFIG_LIB);
        expect(getUiState().seenHints).toContain(Hint.SAW_SPLASH_SCREEN);
        expect(apiPost).toHaveBeenCalledWith("/seen-hints", {
            body: { hint: Hint.SAW_SPLASH_SCREEN }
        });
    });

    it("offers every utility, and opens the one picked", async () => {
        renderWithProviders(<SplashScreen />);
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
        renderWithProviders(<SplashScreen />);
        expect(screen.queryByText(/MKCad/)).toBeNull();
    });

    it("shows once to somebody with a tab, who can close it", async () => {
        updateUiState({ tabId: LibraryId.FRC_DESIGN_LIB });
        renderWithProviders(<SplashScreen />);
        await userEvent.keyboard("{Escape}");

        expect(navigateToTab).not.toHaveBeenCalled();
        expect(getUiState().tabId).toBe(LibraryId.FRC_DESIGN_LIB);
        expect(getUiState().seenHints).toContain(Hint.SAW_SPLASH_SCREEN);
    });

    it("shows signed out, until this browser has seen it", () => {
        access.signedIn = false;
        updateUiState({ tabId: LibraryId.FRC_DESIGN_LIB });
        const { unmount } = renderWithProviders(<SplashScreen />);
        expect(screen.getByText(TITLE)).toBeDefined();
        unmount();

        updateUiState({ seenHints: [Hint.SAW_SPLASH_SCREEN] });
        renderWithProviders(<SplashScreen />);
        expect(screen.queryByText(TITLE)).toBeNull();
    });

    it("stays hidden from somebody with a tab who saw it elsewhere, or until that is known", () => {
        updateUiState({ tabId: LibraryId.FRC_DESIGN_LIB });
        access.seenHints = [Hint.SAW_SPLASH_SCREEN];
        const { unmount } = renderWithProviders(<SplashScreen />);
        expect(screen.queryByText(TITLE)).toBeNull();
        unmount();

        access.seenHints = [];
        access.isPending = true;
        renderWithProviders(<SplashScreen />);
        expect(screen.queryByText(TITLE)).toBeNull();
    });
});
