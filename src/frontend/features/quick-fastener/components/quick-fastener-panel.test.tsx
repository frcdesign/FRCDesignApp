import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    FastenerJobState,
    FastenerMode,
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
import { defaultChoices } from "../options";
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

async function choose(label: string, option: string) {
    await userEvent.click(screen.getByLabelText(label));
    await userEvent.click(await screen.findByRole("option", { name: option }));
}

const insertButton = () =>
    screen.getByRole<HTMLButtonElement>("button", { name: "Insert" });

beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(vi.fn());
    useOnshapeSelection.setState({ current: [], focused: undefined });
    useQuickFastenerStore.setState({
        ...defaultChoices(),
        targets: [],
        excluded: []
    });
});

afterEach(() => vi.restoreAllMocks());

describe("QuickFastenerPanel", () => {
    it("picks faces, with holes to skip, or locations alone", async () => {
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.getByText("Holes to skip")).toBeTruthy();

        await choose("Select by", "Circular edges");

        expect(screen.queryByText("Holes to skip")).toBeNull();
        expect(
            screen.getByText("Circular edges", { selector: "p" })
        ).toBeTruthy();
    });

    it("inserts what's picked with the parts chosen, then clears the picks", async () => {
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
                excluded: [],
                options: expect.objectContaining({
                    mode: FastenerMode.AUTOMATIC,
                    nut: { vendor: "GENERIC", size: "NO_10_32", type: "NYLOCK" }
                })
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

    it("shows a part's rows while it's ticked, and a nut washer only with a nut", async () => {
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        // The nut's Type; the screw washer isn't ticked
        expect(screen.getAllByLabelText("Type")).toHaveLength(1);

        await userEvent.click(
            screen.getByRole("checkbox", { name: "Add screw washer" })
        );
        expect(screen.getAllByLabelText("Type")).toHaveLength(2);

        await userEvent.click(
            screen.getByRole("checkbox", { name: "Add nut" })
        );
        expect(
            screen.queryByRole("checkbox", { name: "Add nut washer" })
        ).toBeNull();
    });

    it("asks for the parts' vendors only under a vendor's screw", async () => {
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.getAllByLabelText("Vendor")).toHaveLength(1);

        await choose("Vendor", "McMaster-Carr");

        // The nut's
        expect(screen.getAllByLabelText("Vendor")).toHaveLength(2);
    });

    it("offers a screw's variants only beside a preset length its vendor sells them in", async () => {
        useQuickFastenerStore.setState({ screw: { vendor: "MCMASTER" } });
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.queryByLabelText("Variant")).toBeNull();

        await choose("Length", "1/2 in.");
        expect(screen.getByLabelText("Variant")).toBeTruthy();

        await choose("Length", "1/8 in.");
        expect(screen.queryByLabelText("Variant")).toBeNull();
    });

    it("has no screw washer under a flat head", () => {
        useQuickFastenerStore.setState({ screw: { head: "FLAT" } });
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.queryByText("Add screw washer")).toBeNull();
    });

    it("stops an automatic screw by the condition chosen, and a preset one not at all", async () => {
        renderWithProviders(<QuickFastenerPanel assembly={ASSEMBLY} />);
        expect(screen.getByLabelText("Max length")).toBeTruthy();
        expect(screen.getByLabelText("Max thread depth")).toBeTruthy();

        await choose("Stop condition", "First gap");
        expect(screen.queryByLabelText("Max length")).toBeNull();
        expect(screen.getByLabelText("Max gap to ignore")).toBeTruthy();

        await choose("Length", "1/2 in.");
        expect(useQuickFastenerStore.getState().mode).toBe(FastenerMode.PRESET);
        expect(screen.queryByLabelText("Stop condition")).toBeNull();
    });
});
