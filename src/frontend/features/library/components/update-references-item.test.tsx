import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "@mantine/core";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { apiPost } from "../../../lib/api-client";
import { UpdateReferencesMenuItem } from "./update-references-item";

vi.mock("../../../lib/api-client", () => ({
    apiPost: vi.fn(() => Promise.resolve({ updatedElements: 0 })),
    apiGet: vi.fn(),
    apiDelete: vi.fn()
}));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

afterEach(() => vi.clearAllMocks());

async function clickItem(documentId: string, elementId?: string) {
    renderWithProviders(
        <Menu opened>
            <Menu.Dropdown>
                <UpdateReferencesMenuItem
                    documentId={documentId}
                    elementId={elementId}
                />
            </Menu.Dropdown>
        </Menu>
    );
    await userEvent.click(
        screen.getByRole("menuitem", { name: "Update references" })
    );
}

describe("update references from the admin menu", () => {
    it("updates one part's tab", async () => {
        await clickItem("doc", "tab");
        expect(apiPost).toHaveBeenCalledWith("/update-references", {
            body: { documentId: "doc", elementId: "tab" }
        });
    });

    it("updates a group's whole document", async () => {
        await clickItem("doc");
        expect(apiPost).toHaveBeenCalledWith("/update-references", {
            body: { documentId: "doc" }
        });
    });
});
