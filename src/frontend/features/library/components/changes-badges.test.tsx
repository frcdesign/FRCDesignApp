import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import type { InsertableOut } from "@backend/features/library/contract";
import type { WorkspaceChangesOut } from "@backend/features/version-manager/contract";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import {
    accessDataQueryKey,
    documentChangesQueryKey
} from "../../../lib/query-keys";
import { useUiState } from "../../../lib/ui-state";

vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { GroupChangesBadge, InsertableChangesBadge } =
    await import("./changes-badges");

const INSERTABLE = {
    id: "ins",
    documentId: "doc",
    elementId: "tab",
    microversionId: "mv-loaded"
} as InsertableOut;

function render(
    node: ReactNode,
    changes: WorkspaceChangesOut,
    adminMode = true
) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.ADMIN,
        signedIn: true,
        seenHints: []
    });
    useUiState.setState({
        accessLevel: adminMode ? AccessLevel.ADMIN : AccessLevel.USER
    });
    for (const includeElements of [false, true]) {
        queryClient.setQueryData(
            documentChangesQueryKey(DEFAULT_LIBRARY, "doc", includeElements),
            changes
        );
    }
    renderWithProviders(node, queryClient);
}

describe("changes since the last version", () => {
    it("counts a group's document's edits in admin mode", () => {
        render(<GroupChangesBadge documentId="doc" />, { changes: 3 });
        expect(screen.getByText("3 changes")).toBeTruthy();
    });

    it("shows nothing outside admin mode", () => {
        render(<GroupChangesBadge documentId="doc" />, { changes: 3 }, false);
        expect(screen.queryByText("3 changes")).toBeNull();
    });

    it("shows nothing for a document with nothing unversioned", () => {
        render(<GroupChangesBadge documentId="doc" />, { changes: 0 });
        expect(screen.queryByText(/change/)).toBeNull();
    });

    it("marks a part whose tab moved past the library's version", () => {
        render(<InsertableChangesBadge insertable={INSERTABLE} />, {
            elements: { tab: "mv-edited" }
        });
        expect(screen.getByText("Changed")).toBeTruthy();
    });

    it("leaves a part whose tab is as the library has it", () => {
        render(<InsertableChangesBadge insertable={INSERTABLE} />, {
            changes: 2,
            elements: { tab: "mv-loaded", other: "mv-edited" }
        });
        expect(screen.queryByText("Changed")).toBeNull();
    });
});
