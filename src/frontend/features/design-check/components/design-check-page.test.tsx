import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import {
    type DesignCheckOut,
    DesignIssueType
} from "@backend/features/design-check/contract";
import { UtilityTab } from "../../../lib/app-tab";
import { type ReactNode } from "react";
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
const apiPost = vi.hoisted(() =>
    vi.fn<(path: string, options?: object) => Promise<object>>(() =>
        Promise.resolve({})
    )
);
vi.mock("../../../lib/api-client", () => ({ apiGet, apiPost }));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));
const selectTab = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/tabs", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../lib/tabs")>()),
    useSelectTab: () => selectTab
}));

const { DesignCheckPage } = await import("./design-check-page");
const { DesignCheckStatus } = await import("./design-check-status");

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
    canDismiss: true,
    checkedAt: Date.UTC(2026, 10, 10, 18, 30)
};

function renderPage(signedIn: boolean, page: ReactNode = <DesignCheckPage />) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn,
        seenHints: []
    });
    renderWithProviders(page, queryClient);
    return queryClient;
}

describe("the design check page", () => {
    beforeEach(() => {
        apiGet.mockReset();
        apiPost.mockReset();
        apiPost.mockResolvedValue({});
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

    it("dismisses an issue at once, and puts it back when saving fails", async () => {
        apiGet.mockResolvedValueOnce(CHECK);
        const saving = Promise.withResolvers<object>();
        apiPost.mockImplementation((path) =>
            path === "/design-check/dismiss"
                ? saving.promise
                : Promise.resolve({})
        );
        renderPage(true);

        await userEvent.click(
            await screen.findByRole("button", { name: "Dismiss" })
        );

        expect(screen.queryByText("Sketch 1")).toBeNull();
        expect(screen.getByText("No issues found")).toBeTruthy();

        act(() => saving.reject(new Error("offline")));

        expect(await screen.findByText("Sketch 1")).toBeTruthy();
    });
});

describe("the navbar's design check summary", () => {
    const DOCUMENT: DesignCheckOut = {
        tabs: [
            {
                elementId: "tab",
                name: "Part Studio 1",
                elementType: ElementType.PART_STUDIO,
                issues: [
                    {
                        type: DesignIssueType.SKETCH_OVERDEFINED,
                        subject: "Sketch 1",
                        featureId: "S1"
                    },
                    {
                        type: DesignIssueType.SKETCH_UNDERDEFINED,
                        subject: "Sketch 2",
                        featureId: "S2",
                        dismissed: true
                    },
                    {
                        type: DesignIssueType.FEATURE_SUPPRESSED,
                        subject: "Fillet 1",
                        featureId: "F1"
                    }
                ],
                sketchStatusUnknown: false,
                failed: false
            },
            {
                elementId: "asm",
                name: "Assembly 1",
                elementType: ElementType.ASSEMBLY,
                issues: [
                    {
                        type: DesignIssueType.INSTANCE_BROKEN,
                        subject: "Gone <1>",
                        instanceId: "gone"
                    },
                    {
                        type: DesignIssueType.INSTANCE_FLOATING,
                        subject: "Plate <1>",
                        instanceId: "plate"
                    }
                ],
                sketchStatusUnknown: false,
                failed: false
            }
        ],
        canDismiss: true,
        checkedAt: Date.UTC(2026, 10, 10, 18, 30)
    };

    beforeEach(() => {
        apiGet.mockReset();
        selectTab.mockReset();
        useOnshapeLaunch.setState(TARGET);
    });

    it("counts the document's errors and warnings, leaving out dismissed ones, and opens Design Check", async () => {
        apiGet.mockResolvedValueOnce(DOCUMENT);
        renderPage(true, <DesignCheckStatus />);

        const open = await screen.findByTitle("Open Design Check");
        expect(open.textContent).toBe("21");

        await userEvent.click(open);
        expect(selectTab).toHaveBeenCalledWith(UtilityTab.DESIGN_CHECK);
    });

    it("shows each tab's counts on hover", async () => {
        apiGet.mockResolvedValueOnce(DOCUMENT);
        renderPage(true, <DesignCheckStatus />);

        await userEvent.hover(await screen.findByTitle("Open Design Check"));

        expect(await screen.findByText("Assembly 1")).toBeTruthy();
        expect(screen.getByText("Part Studio 1")).toBeTruthy();
        expect(screen.getAllByText("1 error")).toHaveLength(2);
        expect(screen.getByText("1 warning")).toBeTruthy();
        expect(screen.getByText("1 info")).toBeTruthy();
    });

    it("shows nothing signed out, and checks nothing", () => {
        renderPage(false, <DesignCheckStatus />);

        expect(screen.queryByTitle("Open Design Check")).toBeNull();
        expect(apiGet).not.toHaveBeenCalled();
    });
});
