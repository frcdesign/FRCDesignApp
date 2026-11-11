import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    type FeatureScriptOut,
    type FeatureScriptsOut
} from "@backend/features/featurescripts/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import {
    featureScriptsQueryKey,
    featureScriptsVersionQueryKey
} from "../../../lib/query-keys";

const apiPost = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/api-client", () => ({ apiPost, apiGet: vi.fn() }));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));
vi.mock("@tanstack/react-router", () => ({
    Link: (props: { children: unknown }) => <a>{props.children as string}</a>
}));

const { FeatureScriptDetails } = await import("./featurescript-details");

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
