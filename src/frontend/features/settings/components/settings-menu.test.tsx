import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { use } from "react";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import type { AdminTeamOut } from "@backend/features/admin-team/contract";
import {
    FeatureScriptsLoadState,
    type FeatureScriptsLoadStatusOut
} from "@backend/features/featurescripts/contract";
import type { QueryClient } from "@tanstack/react-query";
import {
    DEFAULT_LIBRARY,
    LibraryId
} from "@backend/features/library/library-id";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import {
    accessDataQueryKey,
    adminTeamQueryKey,
    featureScriptsLoadStatusQueryKey
} from "../../../lib/query-keys";
import { updateUiState } from "../../../lib/ui-state";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { teamContextQueryKey } from "../../teams/queries";
import {
    DEFAULT_TEAM_SETTINGS,
    OrganizationKind,
    PERSONAL,
    Program,
    TeamContextSource,
    TeamRole,
    type MyTeam,
    type TeamContextOut
} from "@backend/features/teams/contract";

const mocks = vi.hoisted(() => ({
    shownLibraryId: undefined as string | undefined,
    apiPost: vi.fn(),
    // Whatever isn't seeded stays pending.
    apiGet: vi.fn(() => new Promise(() => undefined))
}));

vi.mock("../../../lib/api-client", () => ({
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiDelete: vi.fn()
}));
vi.mock("../../dashboard/dashboard-nav", () => ({
    useIsDashboard: () => false
}));
// No router here: the shown library is the test's, and the override is real.
vi.mock("../../../lib/library", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../../../lib/library")>();
    return {
        ...actual,
        useShownLibraryId: () => mocks.shownLibraryId,
        useLibraryId: () =>
            use(actual.LibraryIdOverride) ??
            mocks.shownLibraryId ??
            DEFAULT_LIBRARY
    };
});

const { SettingsMenuContent } = await import("./settings-menu");

function renderSettings(
    access: Partial<Record<LibraryId, AccessLevel>>,
    viewedAs: AccessLevel,
    seed?: (queryClient: QueryClient) => void
) {
    updateUiState({ accessLevel: viewedAs });
    const queryClient = createTestQueryClient();
    for (const libraryId of Object.values(LibraryId)) {
        queryClient.setQueryData<AccessData>(accessDataQueryKey(libraryId), {
            maxAccessLevel: access[libraryId] ?? AccessLevel.USER,
            signedIn: true,
            seenHints: []
        });
    }
    queryClient.setQueryData<AdminTeamOut>(
        adminTeamQueryKey(LibraryId.FRC_DESIGN_LIB),
        { teamId: "frc-team", memberCount: 3 }
    );
    queryClient.setQueryData<AdminTeamOut>(
        adminTeamQueryKey(LibraryId.CONFIG_LIB),
        { teamId: "config-team", memberCount: 2 }
    );
    seed?.(queryClient);
    renderWithProviders(<SettingsMenuContent />, queryClient);
}

const OWNER_EVERYWHERE = {
    [LibraryId.FRC_DESIGN_LIB]: AccessLevel.OWNER,
    [LibraryId.CONFIG_LIB]: AccessLevel.OWNER,
    [LibraryId.MKCAD]: AccessLevel.OWNER
};

function valueOf(label: string): string {
    return screen.getByLabelText<HTMLInputElement>(label).value;
}

describe("the admin settings", () => {
    afterEach(() => {
        mocks.shownLibraryId = undefined;
        mocks.apiPost.mockReset();
    });

    it("open on the library shown, with its own settings", () => {
        mocks.shownLibraryId = LibraryId.CONFIG_LIB;
        renderSettings(OWNER_EVERYWHERE, AccessLevel.OWNER);

        expect(valueOf("Settings for")).toBe("ConfigLib");
        expect(valueOf("Admin team")).toBe("config-team");
        expect(screen.queryByText("FeatureScripts")).toBeNull();
    });

    it("switch to another library's settings", async () => {
        mocks.shownLibraryId = LibraryId.CONFIG_LIB;
        const user = userEvent.setup();
        renderSettings(OWNER_EVERYWHERE, AccessLevel.OWNER);

        await user.click(screen.getByLabelText("Settings for"));
        await user.click(screen.getByRole("option", { name: "FRCDesignLib" }));

        expect(valueOf("Admin team")).toBe("frc-team");
    });

    it("give the owner the app's own settings, FeatureScripts reload among them", async () => {
        mocks.shownLibraryId = LibraryId.FRC_DESIGN_LIB;
        const user = userEvent.setup();
        renderSettings(OWNER_EVERYWHERE, AccessLevel.OWNER);

        await user.click(screen.getByLabelText("Settings for"));
        await user.click(screen.getByRole("option", { name: "FRCDesignApp" }));
        expect(screen.queryByText("Outdated documents")).toBeNull();
        await user.click(screen.getByRole("button", { name: "Reload" }));

        expect(mocks.apiPost).toHaveBeenCalledWith("/featurescripts/reload", {
            body: { force: false }
        });
    });

    it("show the owner why the last FeatureScripts load failed", () => {
        renderSettings(OWNER_EVERYWHERE, AccessLevel.OWNER, (queryClient) =>
            queryClient.setQueryData<FeatureScriptsLoadStatusOut>(
                featureScriptsLoadStatusQueryKey(),
                {
                    status: {
                        state: FeatureScriptsLoadState.FAILED,
                        startedAt: Date.now(),
                        finishedAt: Date.now(),
                        versionName: "V3",
                        error: "Version V3 of the frontend document has no featurescripts.json"
                    }
                }
            )
        );

        expect(
            screen.getByText("The load of V3 failed just now.")
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();
    });

    it("say when no FeatureScripts load is on record", () => {
        renderSettings(OWNER_EVERYWHERE, AccessLevel.OWNER, (queryClient) =>
            queryClient.setQueryData<FeatureScriptsLoadStatusOut>(
                featureScriptsLoadStatusQueryKey(),
                {}
            )
        );

        expect(
            screen.getByText("No load on record. Reload to start one.")
        ).toBeTruthy();
    });

    it("open on the app's own settings away from a library", () => {
        renderSettings(OWNER_EVERYWHERE, AccessLevel.OWNER);

        expect(valueOf("Settings for")).toBe("FRCDesignApp");
    });

    it("offer an editor only the libraries they edit, wherever they are", async () => {
        mocks.shownLibraryId = LibraryId.FRC_DESIGN_LIB;
        const user = userEvent.setup();
        renderSettings(
            { [LibraryId.CONFIG_LIB]: AccessLevel.EDITOR },
            AccessLevel.EDITOR
        );

        expect(valueOf("Settings for")).toBe("ConfigLib");
        await user.click(screen.getByLabelText("Settings for"));
        expect(
            screen.getAllByRole("option").map((option) => option.textContent)
        ).toEqual(["ConfigLib"]);
    });

    it("keep the access level within reach when viewed as a user", () => {
        renderSettings(OWNER_EVERYWHERE, AccessLevel.USER);

        expect(valueOf("Access level")).toBe("User");
        expect(screen.queryByLabelText("Settings for")).toBeNull();
    });

    it("are not shown to someone who edits no library", () => {
        renderSettings({}, AccessLevel.USER);

        expect(screen.queryByText("Admin settings")).toBeNull();
    });
});

describe("the team rows", () => {
    const team: MyTeam = {
        id: "team-1",
        first: { program: Program.FRC, number: 254, name: "Poofs" },
        role: TeamRole.MEMBER,
        settings: DEFAULT_TEAM_SETTINGS
    };

    function renderWithContext(context: TeamContextOut, documentId?: string) {
        useOnshapeLaunch.setState({ documentId });
        renderSettings({}, AccessLevel.USER, (queryClient) =>
            queryClient.setQueryData(teamContextQueryKey(documentId), context)
        );
    }

    afterEach(() => {
        mocks.apiPost.mockReset();
        useOnshapeLaunch.setState({ documentId: undefined });
    });

    it("switches to Personal outside a team's document", async () => {
        mocks.apiPost.mockResolvedValue({});
        renderWithContext({
            teams: [team],
            current: { teamId: team.id, source: TeamContextSource.CHOSEN }
        });

        expect(valueOf("Team")).toBe("FRC 254");
        await userEvent.click(screen.getByLabelText("Team"));
        await userEvent.click(await screen.findByText("Personal"));
        expect(mocks.apiPost).toHaveBeenCalledWith("/teams/chosen", {
            body: { teamId: PERSONAL }
        });
    });

    it("leaves the team to the document that decides it", () => {
        renderWithContext(
            {
                teams: [team],
                current: { teamId: team.id, source: TeamContextSource.DOCUMENT }
            },
            "doc"
        );

        expect(screen.getByLabelText<HTMLInputElement>("Team").disabled).toBe(
            true
        );
        screen.getByText("Set by this document");
    });

    it("offers registering from an organization's document", () => {
        renderWithContext(
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
        expect(screen.queryByLabelText("Team")).toBeNull();
    });
});
