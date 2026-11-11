import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import {
    type DesignCheckOut,
    DesignIssueType
} from "@backend/features/design-check/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { type TargetElement } from "../../../lib/onshape-launch";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import {
    accessDataQueryKey,
    designCheckQueryKey
} from "../../../lib/query-keys";

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn(() => Promise.resolve({})));
vi.mock("../../../lib/api-client", () => ({ apiGet, apiPost }));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

const { DesignCheckPage } = await import("./design-check-page");

const TARGET: TargetElement = {
    documentId: "doc",
    instanceId: "work",
    instanceType: "w",
    elementId: "tab",
    elementType: ElementType.PART_STUDIO
};

const CHECK: DesignCheckOut = {
    tabs: [
        {
            elementId: "tab",
            name: "Part Studio 1",
            elementType: ElementType.PART_STUDIO,
            issues: [
                {
                    type: DesignIssueType.SKETCH_UNDERDEFINED,
                    subject: "Sketch 1",
                    featureId: "S1"
                }
            ],
            sketchStatusUnknown: false,
            failed: false
        }
    ],
    checkedAt: Date.UTC(2026, 10, 10, 18, 30)
};

function renderPage(signedIn: boolean) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn,
        seenHints: []
    });
    renderWithProviders(<DesignCheckPage />, queryClient);
    return queryClient;
}

describe("the design check page", () => {
    beforeEach(() => {
        apiGet.mockReset();
        useOnshapeLaunch.setState(TARGET);
    });

    it("asks someone signed out to sign in", () => {
        renderPage(false);

        expect(screen.getByText("Sign in to check this document")).toBeTruthy();
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("keeps the last results when checking again fails", async () => {
        apiGet
            .mockResolvedValueOnce(CHECK)
            .mockRejectedValueOnce(new Error("rate limited"));
        const queryClient = renderPage(true);

        expect(await screen.findByText("Sketch 1")).toBeTruthy();

        await act(() =>
            queryClient.refetchQueries({
                queryKey: designCheckQueryKey(TARGET)
            })
        );

        expect(
            await screen.findByText(
                "Failed to check this document again. These are the last results."
            )
        ).toBeTruthy();
        expect(screen.getByText("Sketch 1")).toBeTruthy();
    });
});
