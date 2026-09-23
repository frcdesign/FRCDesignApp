import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "@mantine/core";
import { type ElementPath } from "@backend/lib/onshape/path";
import { renderWithProviders } from "../../__test_utils__/render";
import { OpenDocumentItems } from "./open-document-items";
import { updateUiState } from "../lib/ui-state";

const PATH: ElementPath = {
    documentId: "doc",
    instanceId: "ver",
    instanceType: "v",
    elementId: "el"
};

async function copiedLink(selection?: Record<string, string>) {
    const user = userEvent.setup();
    const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined);
    renderWithProviders(
        <Menu opened>
            <Menu.Target>
                <button>menu</button>
            </Menu.Target>
            <Menu.Dropdown>
                <OpenDocumentItems path={PATH} selection={selection} />
            </Menu.Dropdown>
        </Menu>
    );
    await user.click(screen.getByText("Copy link"));
    return decodeURIComponent(writeText.mock.calls[0][0]);
}

describe("OpenDocumentItems", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        updateUiState({ server: undefined });
    });

    // A favorite's link used to open the part at its defaults.
    it("links to the configuration it is given, as it was typed", async () => {
        expect(await copiedLink({ size: "large", length: "(2 + 3) in" })).toBe(
            "https://cad.onshape.com/documents/doc/v/ver/e/el" +
                "?configuration=size=large;length=(2 + 3) in"
        );
    });

    it("links into the Onshape the panel was launched from", async () => {
        updateUiState({ server: "https://frcdesign.onshape.com" });
        expect(await copiedLink()).toBe(
            "https://frcdesign.onshape.com/documents/doc/v/ver/e/el"
        );
    });

    it("links to the element itself without one", async () => {
        expect(await copiedLink()).toBe(
            "https://cad.onshape.com/documents/doc/v/ver/e/el"
        );
    });
});
