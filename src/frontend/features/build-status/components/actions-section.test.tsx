import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GroupBuildStatus } from "@backend/features/build-checker/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { insertableBuildStatus } from "../../../../__test_utils__/build-status-fixtures";
import { apiPost } from "../../../lib/api-client";
import { GroupActions, InsertableActions } from "./actions-section";

vi.mock("../../../lib/api-client", () => ({
    apiPost: vi.fn(() => Promise.resolve({ updatedElements: 2 })),
    apiGet: vi.fn(),
    apiDelete: vi.fn()
}));

let isHome = true;
vi.mock("../../../lib/library", () => ({
    useIsHome: () => isHome,
    useLibraryId: () => "frc-design-lib"
}));

const idle = { isPending: false, mutate: vi.fn() };
vi.mock("../../library/queries", () => ({
    useCacheVersion: () => 1,
    useLibraryQuery: () => ({
        data: {
            groupOrder: ["first", "group", "last"],
            groups: { group: { documentId: "gearbox" } },
            insertables: {}
        }
    }),
    useReloadThumbnailMutation: () => idle,
    useDeleteGroupMutation: () => idle,
    useSetGroupOrderMutation: () => idle
}));

const GROUP_STATUS: GroupBuildStatus = {
    buildIssues: [],
    sortAlphabetically: false,
    insertableOrder: ["i1"],
    isHeld: false
};

afterEach(() => {
    vi.clearAllMocks();
    isHome = true;
});

describe("the admin card's actions", () => {
    it("updates one element's references in its document", async () => {
        renderWithProviders(
            <InsertableActions
                insertableId="i1"
                status={insertableBuildStatus()}
            />
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Update references" })
        );

        expect(apiPost).toHaveBeenCalledWith("/update-references", {
            body: { documentId: "d", elementId: "e" }
        });
    });

    it("updates a whole group's document, and offers ordering and deleting from the library's list", async () => {
        renderWithProviders(
            <GroupActions
                groupId="group"
                name="Gearbox"
                status={GROUP_STATUS}
            />
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Update references" })
        );

        expect(apiPost).toHaveBeenCalledWith("/update-references", {
            body: { documentId: "gearbox" }
        });
        expect(screen.getByText("Order")).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Delete group" })
        ).toBeTruthy();
    });

    it("leaves ordering and deleting to the library's list", () => {
        isHome = false;
        renderWithProviders(
            <GroupActions
                groupId="group"
                name="Gearbox"
                status={GROUP_STATUS}
            />
        );

        expect(screen.queryByText("Order")).toBeNull();
        expect(
            screen.queryByRole("button", { name: "Delete group" })
        ).toBeNull();
        expect(screen.getByRole("button", { name: "Show all" })).toBeTruthy();
    });
});
