import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import {
    DEFAULT_TEAM_SETTINGS,
    OrganizationKind,
    PERSONAL,
    Program,
    TeamContextSource,
    TeamRole,
    type MyTeam,
    type TeamAdminOut,
    type TeamContextOut
} from "@backend/features/teams/contract";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { accessDataQueryKey } from "../../../lib/query-keys";
import { useOnshapeLaunch } from "../../../lib/onshape-params";

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    apiGet: vi.fn(() => new Promise(() => undefined))
}));

vi.mock("../../../lib/api-client", () => ({
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiDelete: vi.fn()
}));

// No router here: the library is the default one.
vi.mock("../../../lib/library", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useShownLibraryId: () => undefined,
    useLibraryId: () => LibraryId.FRC_DESIGN_LIB
}));

const { teamContextQueryKey } = await import("../queries");
const { TeamPanelContent } = await import("./team-panel");

function team(role = TeamRole.MEMBER): MyTeam {
    return {
        id: "team-1",
        first: { program: Program.FRC, number: 254, name: "Poofs" },
        role,
        settings: DEFAULT_TEAM_SETTINGS
    };
}

function renderPanel(context: TeamContextOut, documentId?: string) {
    useOnshapeLaunch.setState({ documentId });
    const queryClient = createTestQueryClient();
    for (const libraryId of Object.values(LibraryId)) {
        queryClient.setQueryData<AccessData>(accessDataQueryKey(libraryId), {
            maxAccessLevel: AccessLevel.USER,
            signedIn: true,
            seenHints: []
        });
    }
    queryClient.setQueryData(teamContextQueryKey(documentId), context);
    queryClient.setQueryData<TeamAdminOut>(["teams", "team-1", "admin"], {
        organizations: [],
        memberCount: 12,
        adminCount: 1
    });
    renderWithProviders(<TeamPanelContent />, queryClient);
}

describe("the Team panel", () => {
    afterEach(() => {
        mocks.apiPost.mockReset();
        useOnshapeLaunch.setState({ documentId: undefined });
    });

    it("switches to Personal outside a team's document", async () => {
        mocks.apiPost.mockResolvedValue({});
        renderPanel({
            teams: [team()],
            current: { teamId: "team-1", source: TeamContextSource.CHOSEN }
        });

        await userEvent.click(screen.getByLabelText("Team"));
        await userEvent.click(await screen.findByText("Personal"));
        expect(mocks.apiPost).toHaveBeenCalledWith("/teams/chosen", {
            body: { teamId: PERSONAL }
        });
    });

    it("leaves the team to the document that decides it", () => {
        renderPanel(
            {
                teams: [team()],
                current: {
                    teamId: "team-1",
                    source: TeamContextSource.DOCUMENT
                }
            },
            "doc"
        );
        expect(screen.getByLabelText<HTMLInputElement>("Team").disabled).toBe(
            true
        );
        screen.getByText("Set by this document");
        // A member sees none of the team's settings.
        expect(screen.queryByText("Edit favorites")).toBeNull();
    });

    it("offers registering from an organization's document", () => {
        renderPanel(
            {
                teams: [],
                organization: {
                    companyId: "company-1",
                    kind: OrganizationKind.ENTERPRISE,
                    teams: []
                }
            },
            "doc"
        );
        screen.getByRole("button", { name: "Register team" });
    });

    it("lets an admin choose who edits favorites, and name a color", async () => {
        const user = userEvent.setup();
        mocks.apiPost.mockResolvedValue({});
        renderPanel({
            teams: [team(TeamRole.ADMIN)],
            current: { teamId: "team-1", source: TeamContextSource.CHOSEN }
        });

        await user.click(
            screen.getByRole("combobox", { name: "Edit favorites" })
        );
        await user.click(await screen.findByText("Everyone"));
        expect(mocks.apiPost).toHaveBeenCalledWith("/teams/team-1/settings", {
            body: { membersEditFavorites: true }
        });

        await user.type(screen.getByPlaceholderText("Name"), "Poof Blue");
        await user.type(screen.getByPlaceholderText("Hex or RGB"), "#1f3c88");
        await user.click(screen.getByRole("button", { name: "Add" }));
        expect(mocks.apiPost).toHaveBeenCalledWith("/teams/team-1/settings", {
            body: { colors: [{ name: "Poof Blue", hex: "#1f3c88" }] }
        });
        screen.getByText("12 members, 1 admin");
    });

    it("gives an admin an invite link to add a member", async () => {
        const user = userEvent.setup();
        mocks.apiPost.mockResolvedValue({
            token: "token-1",
            expiresAt: Date.now()
        });
        renderPanel({
            teams: [team(TeamRole.ADMIN)],
            current: { teamId: "team-1", source: TeamContextSource.CHOSEN }
        });

        await user.click(screen.getByRole("button", { name: "Add member" }));
        const link =
            await screen.findByLabelText<HTMLInputElement>("Invite link");
        expect(link.value).toContain("joinTeam=token-1");
    });
});
