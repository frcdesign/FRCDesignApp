import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    FastenerJobState,
    FastenerTaskAction,
    FastenerTaskState,
    SelectionMode
} from "@backend/features/quick-fastener/contract";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { apiPost } from "../../../lib/api-client";
import { fastenerJobQueryKey } from "../../../lib/query-keys";
import {
    useOnshapeSelection,
    type OnshapeSelection
} from "../../../lib/selection";
import { defaultOptions } from "../options";
import { useQuickFastenerStore } from "../store";
import { QuickFastenerPanel } from "./quick-fastener-panel";

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(() =>
        Promise.resolve({ state: FastenerJobState.RUNNING, tasks: [] })
    )
}));

// Signed out, so the job query only reads what a test seeds
vi.mock("../../auth/access-level", () => ({ useIsSignedIn: () => false }));

const ASSEMBLY = {
    documentId: "doc",
    instanceType: "w" as const,
    instanceId: "ws",
    elementId: "asm"
};

const face = (id: string): OnshapeSelection => ({
    entityType: "FACE",
    selectionId: id,
    occurrencePath: ["plate"]
});

function select(...selections: OnshapeSelection[]) {
    act(() => useOnshapeSelection.getState().receive(selections));
}

const insertButton = () =>
    screen.getByRole<HTMLButtonElement>("button", { name: "Insert" });

beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(vi.fn());
    useOnshapeSelection.setState({ current: [], focused: undefined });
    useQuickFastenerStore.setState({
        options: defaultOptions(),
        selectionMode: SelectionMode.FACES,
        targets: [],
        excluded: []
    });
});

afterEach(() => vi.restoreAllMocks());

describe("QuickFastenerPanel", () => {
    it("skips holes only when fastening faces", async () => {
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.getByText("Holes to skip")).toBeTruthy();

        await userEvent.click(screen.getByText("Circular edges"));

        expect(screen.queryByText("Holes to skip")).toBeNull();
        expect(
            screen.getByText("Circular edges", { selector: "p" })
        ).toBeTruthy();
    });

    it("inserts what's picked, then clears the picks", async () => {
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(insertButton().disabled).toBe(true);

        await userEvent.click(screen.getAllByText("Click to select")[0]);
        select(face("F"));
        await userEvent.click(insertButton());

        expect(apiPost).toHaveBeenCalledWith("/quick-fastener/insert", {
            body: expect.objectContaining({
                selectionMode: SelectionMode.FACES,
                targets: [
                    {
                        occurrencePath: ["plate"],
                        entityId: "F",
                        entityType: "FACE"
                    }
                ],
                excluded: []
            })
        });
        expect(useQuickFastenerStore.getState().targets).toEqual([]);
    });

    it("says a run is going and that it can be left, and holds the next one", () => {
        useQuickFastenerStore.setState({ targets: [face("F")] });
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(fastenerJobQueryKey(ASSEMBLY), {
            state: FastenerJobState.RUNNING,
            tasks: [
                {
                    action: FastenerTaskAction.INDEX,
                    state: FastenerTaskState.RUNNING
                }
            ]
        });
        renderWithProviders(
            <QuickFastenerPanel assembly={ASSEMBLY} />,
            queryClient
        );

        expect(
            screen.getByText("Indexing holes... You can leave this page.")
        ).toBeTruthy();
        expect(insertButton().disabled).toBe(true);
    });

    it("offers a start washer only under a head that sits on the surface", () => {
        useQuickFastenerStore.setState({
            options: { ...defaultOptions(), head: "FLAT" }
        });
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);

        expect(
            screen.getByRole<HTMLInputElement>("checkbox", {
                name: "Add start washer"
            }).disabled
        ).toBe(true);
    });

    it("asks for the max gap once gaps are respected", async () => {
        const user = userEvent.setup();
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.getByLabelText("Max length")).toBeTruthy();

        await user.click(screen.getByLabelText("Stop condition"));
        await user.click(
            await screen.findByRole("option", { name: "Respect gaps" })
        );

        expect(screen.queryByLabelText("Max length")).toBeNull();
        expect(screen.getByLabelText("Max gap to ignore")).toBeTruthy();
    });
});
