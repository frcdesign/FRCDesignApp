import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AccessLevel,
    type AccessData
} from "@backend/features/auth/access-level";
import {
    StepExportState,
    stepExportFilePath
} from "@backend/features/download/contract";
import { type InsertableOut } from "@backend/features/library/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { apiGet, apiPost } from "../../../lib/api-client";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { queryClient } from "../../../lib/query-client";
import { accessDataQueryKey } from "../../../lib/query-keys";
import { DownloadStepButton } from "./download-step-button";

vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn()
}));

const PATH = {
    documentId: "doc",
    instanceId: "v",
    instanceType: "v",
    elementId: "el"
} as const;

const INSERTABLE: InsertableOut = {
    id: "ins",
    elementId: PATH.elementId,
    groupId: "group",
    documentId: PATH.documentId,
    versionId: PATH.instanceId,
    path: PATH,
    name: "Bearing",
    microversionId: "mv",
    isVisible: true,
    supportsFasten: false,
    elementType: ElementType.PART_STUDIO,
    isConfigurable: true,
    vendors: []
};

function seedAccess(signedIn: boolean) {
    queryClient.setQueryData<AccessData>(accessDataQueryKey(DEFAULT_LIBRARY), {
        maxAccessLevel: AccessLevel.USER,
        signedIn,
        seenHints: []
    });
}

/** Each poll answers with the next state; access data stays the seeded value. */
function mockExportStates(...states: StepExportState[]) {
    vi.mocked(apiGet).mockImplementation((path: string) => {
        if (!path.startsWith("/step-export/")) {
            return new Promise(() => undefined);
        }
        const state = states.shift() ?? StepExportState.ACTIVE;
        return Promise.resolve({ state });
    });
}

function statusPolls(): number {
    return vi
        .mocked(apiGet)
        .mock.calls.filter(([path]) => path.startsWith("/step-export/")).length;
}

function renderButton() {
    renderWithProviders(
        <DownloadStepButton
            insertable={INSERTABLE}
            selection={{ size: "2" }}
        />,
        queryClient
    );
}

describe("DownloadStepButton", () => {
    let savedFiles: string[];

    beforeEach(() => {
        savedFiles = [];
        // Access data stays what each test seeds.
        mockExportStates();
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
            function (this: HTMLAnchorElement) {
                savedFiles.push(this.getAttribute("href") ?? "");
            }
        );
    });

    afterEach(() => {
        queryClient.clear();
        vi.restoreAllMocks();
        vi.mocked(apiGet).mockReset();
        vi.mocked(apiPost).mockReset();
        vi.useRealTimers();
    });

    it("isn't offered inside Onshape, where the part is inserted instead", () => {
        useOnshapeLaunch.setState({
            ...PATH,
            instanceType: "w",
            elementType: ElementType.ASSEMBLY
        });
        seedAccess(true);
        renderButton();

        expect(screen.queryByRole("button")).toBeNull();
    });

    it("asks a signed-out caller to sign in first", () => {
        seedAccess(false);
        renderButton();

        expect(screen.getByRole("button").textContent).toBe(
            "Sign in to download"
        );
    });

    it("exports the selection, waits for Onshape, then saves the file", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime
        });
        vi.mocked(apiPost).mockResolvedValue({ translationId: "tr-1" });
        mockExportStates(StepExportState.ACTIVE, StepExportState.DONE);
        seedAccess(true);
        renderButton();

        await user.click(screen.getByText("Download STEP"));
        await vi.advanceTimersByTimeAsync(5000);

        await waitFor(() =>
            expect(savedFiles).toEqual([stepExportFilePath("tr-1")])
        );
        expect(apiPost).toHaveBeenCalledWith("/step-export/insertable/ins", {
            body: { selection: { size: "2" } }
        });
        expect(statusPolls()).toBe(2);
    });

    it("saves nothing when Onshape fails the export", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = userEvent.setup({
            advanceTimers: vi.advanceTimersByTime
        });
        vi.mocked(apiPost).mockResolvedValue({ translationId: "tr-1" });
        mockExportStates(StepExportState.FAILED);
        seedAccess(true);
        renderButton();

        await user.click(screen.getByText("Download STEP"));
        await vi.advanceTimersByTimeAsync(5000);

        await waitFor(() => expect(statusPolls()).toBe(1));
        expect(savedFiles).toEqual([]);
    });
});
