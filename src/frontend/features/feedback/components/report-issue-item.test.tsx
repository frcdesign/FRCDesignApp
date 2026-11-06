import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "@mantine/core";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import { Hint } from "@backend/features/hints/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import type { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { accessDataQueryKey } from "../../../lib/query-keys";

const openPartReport = vi.hoisted(() => vi.fn());
vi.mock("../open-feedback", () => ({ openPartReport }));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { ReportIssueItem } = await import("./report-issue-item");

const INSERTABLE = {
    id: "ins",
    name: "Hex shaft",
    elementType: ElementType.PART_STUDIO,
    isConfigurable: true
} as InsertableOut;

function renderItem(seenHints: Hint[] = []) {
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
                <ReportIssueItem
                    insertable={INSERTABLE}
                    selection={{ size: "half" }}
                />
            </Menu.Dropdown>
        </Menu>,
        queryClient
    );
    return screen.getByRole("menuitem", { name: "Report an issue" });
}

const dot = () => document.querySelector(".mantine-Indicator-indicator");

describe("Report an issue", () => {
    afterEach(() => openPartReport.mockReset());

    it("opens a report about the part in its configuration", async () => {
        const user = userEvent.setup();

        await user.click(renderItem());

        expect(openPartReport).toHaveBeenCalledWith(DEFAULT_LIBRARY, {
            insertable: INSERTABLE,
            selection: { size: "half" }
        });
    });

    it("is dotted until a menu offering it has been opened", () => {
        renderItem();
        expect(dot()).not.toBeNull();
    });

    it("drops its dot once seen", () => {
        renderItem([Hint.OPENED_REPORT_ISSUE]);
        expect(dot()).toBeNull();
    });
});
