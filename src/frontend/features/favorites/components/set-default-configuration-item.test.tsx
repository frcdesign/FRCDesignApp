import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "@mantine/core";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import type { Favorite } from "@backend/features/favorites/contract";
import { Hint } from "@backend/features/hints/contract";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { accessDataQueryKey } from "../../../lib/query-keys";
import type { SelectionReport } from "../../insert/components/configurations";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("../queries", () => ({
    useSetDefaultConfigurationMutation: () => ({ mutate, isPending: false })
}));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { SetDefaultConfigurationItem } =
    await import("./set-default-configuration-item");

const FAVORITE: Favorite = {
    id: "fav",
    insertableId: "ins",
    libraryId: LibraryId.FRC_DESIGN_LIB,
    defaultSelection: { size: "small", length: "1 in" }
};

function report(
    selection: Record<string, string>,
    overrides: Record<string, string> = {}
): SelectionReport {
    return {
        // A derivation variable rides along, but the favorite never keeps one.
        selection: { ...selection, dv: "uuid" },
        stored: selection,
        overrides,
        configurationKey: "key",
        record: undefined
    };
}

function renderItem(
    favorite: Favorite,
    onScreen: SelectionReport,
    seenHints: Hint[] = []
) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn: true,
        seenHints
    });
    renderWithProviders(
        <Menu opened>
            <Menu.Target>
                <button>menu</button>
            </Menu.Target>
            <Menu.Dropdown>
                <SetDefaultConfigurationItem
                    favorite={favorite}
                    report={onScreen}
                />
            </Menu.Dropdown>
        </Menu>,
        queryClient
    );
    return screen.getByRole("menuitem", {
        name: "Set default configuration"
    });
}

const dot = () => document.querySelector(".mantine-Indicator-indicator");

describe("setting the default configuration", () => {
    afterEach(() => mutate.mockReset());

    it("makes the configuration on screen the favorite's default", async () => {
        const user = userEvent.setup();
        const onScreen = report({ size: "large", length: "1 in" });

        await user.click(renderItem(FAVORITE, onScreen));

        expect(mutate).toHaveBeenCalledWith({
            selection: onScreen.selection,
            configurationKey: "key"
        });
    });

    it("is off when the favorite already opens with it", () => {
        const item = renderItem(
            FAVORITE,
            report({ size: "small", length: "1 in" })
        );
        expect(item).toHaveProperty("disabled", true);
    });

    // Saved as entered, so a different spelling of the same size still saves.
    it("sets an expression that spells the default differently", () => {
        const item = renderItem(
            FAVORITE,
            report({ size: "small", length: "(0.5 + 0.5) in" })
        );
        expect(item).toHaveProperty("disabled", false);
    });

    it("counts a favorite with no selection as opening on the defaults", () => {
        const noSelection = { ...FAVORITE, defaultSelection: undefined };
        expect(
            renderItem(noSelection, report({ size: "small" }))
        ).toHaveProperty("disabled", true);
    });

    it("is dotted until the menu offering it has been opened", () => {
        renderItem(FAVORITE, report({ size: "large" }));
        expect(dot()).not.toBeNull();
    });

    it("drops its dot once seen", () => {
        renderItem(FAVORITE, report({ size: "large" }), [
            Hint.OPENED_SET_DEFAULT_CONFIGURATION
        ]);
        expect(dot()).toBeNull();
    });
});
