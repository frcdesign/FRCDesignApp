import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type FeatureScriptOut,
    type FeatureScriptsOut
} from "@backend/features/featurescripts/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import {
    accessDataQueryKey,
    featureScriptFavoritesQueryKey,
    featureScriptsQueryKey,
    featureScriptsVersionQueryKey
} from "../../../lib/query-keys";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";

const apiPost = vi.hoisted(() => vi.fn());
const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/api-client", () => ({
    apiPost,
    apiGet,
    apiDelete: vi.fn()
}));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));
vi.mock("@tanstack/react-router", () => ({
    Link: (props: { children: unknown }) => <a>{props.children as string}</a>,
    useNavigate: () => vi.fn()
}));

const { FeatureScriptDetails } = await import("./featurescript-details");
const { FeatureScriptList } = await import("./featurescript-list");

const FRAME: FeatureScriptOut = {
    id: "frame",
    name: "Robot frame",
    description: "Add tube along an edge.\nOr extrude it from a point.",
    releaseVersion: "1.3.0",
    problems: []
};

const PART_STUDIO = {
    documentId: "doc",
    instanceType: "w",
    instanceId: "ws",
    elementId: "ps",
    elementType: ElementType.PART_STUDIO
} as const;

function renderDetails(feature: FeatureScriptOut) {
    const { queryClient } = renderWithProviders(
        <FeatureScriptDetails feature={feature} />
    );
    queryClient.setQueryData(featureScriptsVersionQueryKey(), 0);
    queryClient.setQueryData<FeatureScriptsOut>(featureScriptsQueryKey(0), {
        documentId: "frontend",
        versionId: "v-1",
        features: [feature]
    });
    return queryClient;
}

describe("FeatureScriptDetails", () => {
    afterEach(() => {
        apiPost.mockReset();
        vi.restoreAllMocks();
    });

    it("shows the feature, and why it can't be added outside a Part Studio", async () => {
        const user = userEvent.setup();
        renderDetails(FRAME);

        expect(
            screen.getByRole("heading", { name: "Robot frame" })
        ).toBeTruthy();
        expect(screen.getByText("v1.3.0")).toBeTruthy();
        expect(screen.getByText(/Or extrude it from a point/)).toBeTruthy();
        // No example: the generic hero, and nothing to open.
        expect(screen.getByText("No example yet")).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: "Open example" })
        ).toBeNull();

        const add = screen.getByRole("button", { name: "Add to Part Studio" });
        await user.click(add);
        expect(apiPost).not.toHaveBeenCalled();
        await user.hover(add);
        expect(
            await screen.findByText("Open a Part Studio to add this feature.")
        ).toBeTruthy();
    });

    it("adds the feature to the Part Studio, then opens its dialog in Onshape", async () => {
        const user = userEvent.setup();
        useOnshapeLaunch.setState(PART_STUDIO);
        const postMessage = vi.spyOn(window.parent, "postMessage");
        apiPost.mockResolvedValue({ featureId: "feat-1" });
        renderDetails({ ...FRAME, exampleElementId: "e-example" });

        await user.click(
            screen.getByRole("button", { name: "Add to Part Studio" })
        );

        expect(apiPost).toHaveBeenCalledWith("/featurescripts/frame/add", {
            body: {
                targetPath: {
                    documentId: "doc",
                    instanceId: "ws",
                    instanceType: "w",
                    elementId: "ps"
                }
            }
        });
        await waitFor(() =>
            expect(postMessage).toHaveBeenCalledWith(
                {
                    messageName: "openFeatureDialog",
                    featureId: "feat-1",
                    documentId: "doc",
                    workspaceId: "ws",
                    elementId: "ps"
                },
                "*"
            )
        );

        const open = vi.spyOn(window, "open").mockReturnValue(null);
        await user.click(screen.getByRole("button", { name: "Open example" }));
        expect(open).toHaveBeenCalledWith(
            "https://cad.onshape.com/documents/frontend/v/v-1/e/e-example",
            "_blank"
        );
    });
});

function feature(
    id: string,
    name: string,
    category?: string
): FeatureScriptOut {
    return { id, name, description: `${name}.`, category, problems: [] };
}

/** In the frontend document's tab order, folder by folder. */
const LISTED: FeatureScriptOut[] = [
    feature("lighten", "Robot lighten", "Lightening"),
    feature("rib", "Quick rib", "Lightening"),
    feature("extrude", "Multi extrude", "Basic operations"),
    feature("loose", "Loose feature"),
    feature("frame", "Robot frame", "Parts")
];

const SECTIONS = /^(Favorites|Lightening|Basic operations|Parts|Other)$/;

/** Seeded before rendering, so the list never shows loading. */
function renderList(favoriteIds: string[]) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(featureScriptsVersionQueryKey(), 0);
    queryClient.setQueryData<FeatureScriptsOut>(featureScriptsQueryKey(0), {
        documentId: "frontend",
        versionId: "v-1",
        features: LISTED
    });
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn: true,
        seenHints: []
    });
    queryClient.setQueryData(featureScriptFavoritesQueryKey(), {
        featureScriptIds: favoriteIds
    });
    // What the refetch after a toggle answers.
    apiGet.mockResolvedValue({ featureScriptIds: favoriteIds });
    renderWithProviders(<FeatureScriptList />, queryClient);
}

function sectionNames(): string[] {
    return screen.getAllByText(SECTIONS).map((element) => element.textContent);
}

describe("FeatureScriptList", () => {
    afterEach(() => {
        apiPost.mockReset();
        apiGet.mockReset();
        vi.restoreAllMocks();
    });

    it("shows favorites, then each folder in the document's order, the unfiled last", async () => {
        renderList(["frame"]);

        await screen.findByText("Favorites");
        expect(sectionNames()).toEqual([
            "Favorites",
            "Lightening",
            "Basic operations",
            "Parts",
            "Other"
        ]);
        // In Favorites and in Parts.
        expect(screen.getAllByText("Robot frame")).toHaveLength(2);
    });

    it("favorites a feature from its row, which shows it in Favorites at once", async () => {
        const user = userEvent.setup();
        renderList([]);
        await screen.findByText("Quick rib");
        expect(screen.queryByText("Favorites")).toBeNull();

        // The server's answer to the refetch once the favorite lands.
        apiGet.mockResolvedValue({ featureScriptIds: ["rib"] });
        const rib = screen.getByText("Quick rib").closest("tr");
        await user.click(
            within(rib as HTMLElement).getByRole("button", { name: "Favorite" })
        );

        expect(apiPost).toHaveBeenCalledWith("/featurescripts/rib/favorite");
        expect(await screen.findByText("Favorites")).toBeTruthy();
        expect(screen.getAllByText("Quick rib")).toHaveLength(2);
    });

    it("searches every folder, without repeating favorites", async () => {
        const user = userEvent.setup();
        renderList(["rib"]);
        await screen.findByText("Favorites");

        await user.type(
            screen.getByPlaceholderText("Search FeatureScripts..."),
            "robot"
        );

        expect(sectionNames()).toEqual(["Lightening", "Parts"]);
        expect(screen.queryByText("Quick rib")).toBeNull();
        expect(screen.getByText("Robot lighten")).toBeTruthy();
    });
});
