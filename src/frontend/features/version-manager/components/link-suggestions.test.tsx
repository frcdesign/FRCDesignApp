import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    LinkDirection,
    toWorkspacePath,
    type SuggestedLink
} from "@backend/features/version-manager/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { apiPost } from "../../../lib/api-client";
import { type LinkActions } from "../link-actions";
import { LinkedWorkspaceSection } from "./linked-workspace-section";
import { VersionManagerZeroState } from "./version-manager-zero-state";

vi.mock("../../../lib/api-client", () => ({
    apiPost: vi.fn(() => Promise.resolve({ linked: 2 })),
    apiGet: vi.fn(),
    apiDelete: vi.fn()
}));

const WORKSPACE = toWorkspacePath("robot", "robot-w");

const SUGGESTIONS: SuggestedLink[] = [
    {
        workspace: toWorkspacePath("gearbox", "gearbox-w"),
        documentName: "Gearbox",
        workspaceName: "Main"
    },
    {
        workspace: toWorkspacePath("intake", "intake-w"),
        documentName: "Intake"
    }
];

function renderZeroState(suggestions: SuggestedLink[]) {
    renderWithProviders(
        <VersionManagerZeroState
            workspace={WORKSPACE}
            documentName="Robot"
            suggestions={suggestions}
        />
    );
}

afterEach(() => vi.clearAllMocks());

describe("suggested links on the welcome page", () => {
    it("links every suggestion as a parent at once", async () => {
        renderZeroState(SUGGESTIONS);

        expect(
            screen.getByText("Link these documents to pull changes into Robot.")
        ).toBeTruthy();
        await userEvent.click(screen.getByRole("button", { name: "Link all" }));

        expect(apiPost).toHaveBeenCalledWith("/workspace-links/parents", {
            body: {
                workspace: WORKSPACE,
                parents: SUGGESTIONS.map((each) => each.workspace)
            }
        });
    });

    it("links one suggestion from its row", async () => {
        renderZeroState(SUGGESTIONS);

        const [gearbox] = screen.getAllByRole("button", { name: "Link" });
        await userEvent.click(gearbox);

        expect(apiPost).toHaveBeenCalledWith("/workspace-links", {
            body: {
                workspace: WORKSPACE,
                linked: SUGGESTIONS[0].workspace,
                direction: LinkDirection.PARENT
            }
        });
    });

    it("swaps the suggestions for linking by url, and back", async () => {
        renderZeroState(SUGGESTIONS);
        expect(
            screen.queryByText("The document I'm linking to is...")
        ).toBeNull();

        await userEvent.click(
            screen.getByRole("button", { name: "Link a different document" })
        );
        expect(
            screen.getByText("The document I'm linking to is...")
        ).toBeTruthy();
        expect(screen.queryByText("Suggested links")).toBeNull();

        await userEvent.click(
            screen.getByRole("button", { name: "Back to suggested links" })
        );
        expect(screen.getByText("Suggested links")).toBeTruthy();
    });

    it("offers linking by url alone when nothing is suggested", () => {
        renderZeroState([]);

        expect(screen.queryByText("Suggested links")).toBeNull();
        expect(
            screen.getByText("The document I'm linking to is...")
        ).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: "Link a different document" })
        ).toBeNull();
    });
});

describe("suggested links in the parents' list", () => {
    const actions: LinkActions = {
        running: undefined,
        isRunningFor: () => false,
        isRunningForAll: false,
        openOne: vi.fn(),
        quickAll: vi.fn(),
        quickOne: vi.fn(),
        updateOne: vi.fn(),
        updateAll: vi.fn()
    };

    function renderParents(suggestions: SuggestedLink[]) {
        renderWithProviders(
            <LinkedWorkspaceSection
                workspace={WORKSPACE}
                direction={LinkDirection.PARENT}
                linked={[]}
                suggestions={suggestions}
                actions={actions}
            />
        );
    }

    it("lists the suggestions in place of the empty notice", () => {
        renderParents(SUGGESTIONS);

        expect(screen.queryByText("No linked parents")).toBeNull();
        expect(screen.getByText("Gearbox")).toBeTruthy();
        expect(screen.getAllByRole("button", { name: "Link" })).toHaveLength(2);
    });

    it("says nothing is linked when nothing is suggested either", () => {
        renderParents([]);

        expect(screen.getByText("No linked parents")).toBeTruthy();
    });
});
