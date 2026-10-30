import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AssemblyJobState,
    FastenerMode,
    AssemblyTaskAction,
    AssemblyTaskState,
    SelectionMode
} from "@backend/features/auto-assembly/contract";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { apiPost } from "../../../lib/api-client";
import {
    FASTENER_SET_QUERY_KEY,
    assemblyJobQueryKey
} from "../../../lib/query-keys";
import { FASTENER_SET } from "../../../../__test_utils__/fastener-set";
import {
    useOnshapeSelection,
    type OnshapeSelection
} from "../../../lib/selection";
import { defaultChoices } from "../options";
import { useAutoAssemblyStore } from "../store";
import { AutoAssemblyPanel } from "./auto-assembly-panel";

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(() =>
        Promise.resolve({ state: AssemblyJobState.RUNNING, tasks: [] })
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

/** As the app renders it, the library having loaded the fasteners. */
function renderPanel(queryClient = createTestQueryClient()) {
    queryClient.setQueryData(FASTENER_SET_QUERY_KEY, FASTENER_SET);
    return renderWithProviders(
        <AutoAssemblyPanel assembly={ASSEMBLY} />,
        queryClient
    );
}

const insertButton = () =>
    screen.getByRole<HTMLButtonElement>("button", { name: "Insert" });

beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(vi.fn());
    useOnshapeSelection.setState({
        focused: undefined,
        shown: [],
        awaited: undefined
    });
    useAutoAssemblyStore.setState({
        ...defaultChoices(),
        targets: [],
        excluded: [],
        replaced: []
    });
});

afterEach(() => vi.restoreAllMocks());

describe("AutoAssemblyPanel", () => {
    it("says so until the library has loaded the fasteners", () => {
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(FASTENER_SET_QUERY_KEY, null);
        renderWithProviders(
            <AutoAssemblyPanel assembly={ASSEMBLY} />,
            queryClient
        );
        expect(screen.getByText("No fasteners are loaded yet.")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Insert" })).toBeNull();
    });

    it("picks circular edges by default, or faces with holes to skip", async () => {
        renderPanel();
        expect(
            screen.getByText("Circular edges", { selector: "p" })
        ).toBeTruthy();
        expect(screen.queryByText("Holes to skip")).toBeNull();

        await choose("Select by", "Faces");

        expect(screen.getByText("Holes to skip")).toBeTruthy();
    });

    it("inserts what's picked with the parts chosen, then clears the picks", async () => {
        renderPanel();
        await choose("Select by", "Faces");
        expect(insertButton().disabled).toBe(true);

        await userEvent.click(screen.getByText("Faces", { selector: "p" }));
        select(face("F"));
        await userEvent.click(insertButton());

        expect(apiPost).toHaveBeenCalledWith("/auto-assembly/insert", {
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
                    nut: {
                        vendor: "MCMASTER",
                        size: "NO_10_32",
                        type: "NYLOCK"
                    }
                })
            })
        });
        expect(useAutoAssemblyStore.getState().targets).toEqual([]);
    });

    it("replaces the screws picked, with nothing else picked", async () => {
        renderPanel();
        await userEvent.click(screen.getByText("Screws to replace"));
        // The focus moved from Circular edges, whose request this clears
        act(() => useOnshapeSelection.getState().receive([]));
        select(face("S"));
        expect(screen.getByText("Screw 1")).toBeTruthy();

        await userEvent.click(insertButton());
        expect(apiPost).toHaveBeenCalledWith("/auto-assembly/insert", {
            body: expect.objectContaining({
                targets: [],
                replaced: [
                    {
                        occurrencePath: ["plate"],
                        entityId: "S",
                        entityType: "FACE"
                    }
                ]
            })
        });
        expect(useAutoAssemblyStore.getState().replaced).toEqual([]);
    });

    it("says a run is going and that it can be left, and holds the next one", () => {
        useAutoAssemblyStore.setState({ targets: [face("F")] });
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(assemblyJobQueryKey(ASSEMBLY), {
            state: AssemblyJobState.RUNNING,
            tasks: [
                {
                    action: AssemblyTaskAction.INDEX,
                    state: AssemblyTaskState.RUNNING
                }
            ]
        });
        renderPanel(queryClient);

        expect(
            screen.getByText("Indexing holes... You can leave this page.")
        ).toBeTruthy();
        expect(insertButton().disabled).toBe(true);
    });

    it("shows a part's rows while it's ticked, and a nut washer only with a nut", async () => {
        // Generic makes one washer in each size, so its Type would be hidden
        useAutoAssemblyStore.setState({ screw: { vendor: "MCMASTER" } });
        renderPanel();
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

    it("asks for a washer's vendor only under a vendor's screw, and never a nut's", async () => {
        renderPanel();
        await userEvent.click(
            screen.getByRole("checkbox", { name: "Add screw washer" })
        );
        // The screw's: the default screw is Generic, and McMaster-Carr makes every nut
        expect(screen.getAllByLabelText("Vendor")).toHaveLength(1);

        await choose("Vendor", "McMaster-Carr");
        expect(screen.getAllByLabelText("Vendor")).toHaveLength(2);
    });

    it("sizes a screw automatically until switched to manual, then asks its length", async () => {
        renderPanel();
        expect(screen.queryByLabelText("Length")).toBeNull();

        await choose("Sizing", "Manual");
        expect(useAutoAssemblyStore.getState().mode).toBe(FastenerMode.PRESET);
        expect(screen.getByLabelText("Length")).toBeTruthy();

        await choose("Sizing", "Automatic");
        expect(useAutoAssemblyStore.getState().mode).toBe(
            FastenerMode.AUTOMATIC
        );
        expect(screen.queryByLabelText("Length")).toBeNull();
    });

    it("asks for a screw's finish before its length, and whether it's fully threaded only beside a manual length sold both ways", async () => {
        useAutoAssemblyStore.setState({
            mode: FastenerMode.PRESET,
            screw: { vendor: "MCMASTER", size: "NO_8_32", head: "SOCKET" }
        });
        renderPanel();
        expect(screen.getByLabelText("Finish")).toBeTruthy();
        expect(screen.queryByLabelText("Fully threaded")).toBeNull();

        await choose("Length", "2 in");
        expect(screen.getByLabelText("Fully threaded")).toBeTruthy();

        await choose("Length", "1/2 in");
        expect(screen.queryByLabelText("Fully threaded")).toBeNull();
    });

    it("asks what to fasten with before what to fasten", () => {
        renderPanel();
        const headings = screen
            .getAllByRole("heading")
            .map((heading) => heading.textContent);
        expect(headings).toEqual(["Fastener", "Selections"]);
    });

    it("has no screw washer under a flat head", () => {
        useAutoAssemblyStore.setState({ screw: { head: "FLAT" } });
        renderPanel();
        expect(screen.queryByText("Add screw washer")).toBeNull();
    });

    it("stops an automatic screw by the condition chosen, and a manual one not at all", async () => {
        renderPanel();
        expect(screen.queryByLabelText("Max gap to ignore")).toBeNull();
        expect(screen.getByLabelText("Max thread depth")).toBeTruthy();

        await choose("Stop condition", "First gap");
        expect(screen.getByLabelText("Max gap to ignore")).toBeTruthy();

        await choose("Sizing", "Manual");
        expect(screen.queryByLabelText("Stop condition")).toBeNull();
    });

    it("asks for a maximum length only once screw length is limited", async () => {
        renderPanel();
        expect(screen.queryByLabelText("Max length")).toBeNull();

        await userEvent.click(screen.getByLabelText("Limit screw length"));
        expect(screen.getByLabelText("Max length")).toBeTruthy();
    });
});
