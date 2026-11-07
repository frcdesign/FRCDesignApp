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
            screen.getByText("Found 2 documents this one references")
        ).toBeTruthy();
        await userEvent.click(
            screen.getByRole("button", { name: "Link all as parents" })
        );

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

    it("offers nothing when the document references nothing unlinked", () => {
        renderZeroState([]);

        expect(screen.queryByText(/this one references/)).toBeNull();
        expect(screen.getByText("Welcome to Version Manager!")).toBeTruthy();
    });
});
