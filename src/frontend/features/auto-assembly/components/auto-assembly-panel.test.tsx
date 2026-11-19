import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    AssemblyJobState,
    FastenerMode,
    AssemblyTaskAction,
    AssemblyTaskState,
    PickList,
    ProblemSeverity,
    RunPartRole,
    SelectedEntityType,
    SelectionMode,
    StopCondition
} from "@backend/features/auto-assembly/contract";
import {
    createTestQueryClient,
    renderWithProviders
} from "../../../../__test_utils__/render";
import { apiPost } from "../../../lib/api-client";
import {
    FASTENER_SET_QUERY_KEY,
    assemblyJobQueryKey,
    pickCheckQueryKey
} from "../../../lib/query-keys";
import { FASTENER_SET } from "../../../../__test_utils__/fastener-set";
import {
    toSelectedEntities,
    useOnshapeSelection,
    type OnshapeSelection
} from "../../../lib/selection";
import { defaultChoices, fastenerOptions, settleChoices } from "../options";
import { useAutoAssemblyStore } from "../store";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { AutoAssemblyPanel } from "./auto-assembly-panel";
import { JobDetails, JobDetailsTitle } from "./job-details";
import { AutoAssemblyCallout } from "./auto-assembly-callout";
import { UtilityTab } from "../../../lib/app-tab";
import { FastenerKind } from "@backend/features/auto-assembly/studios";
import {
    DEFAULT_TEAM_SETTINGS,
    GenericVendorPolicy,
    type TeamSettings
} from "@backend/features/teams/contract";

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(() =>
        Promise.resolve({ state: AssemblyJobState.RUNNING, tasks: [] })
    )
}));

const { navigateToTab } = vi.hoisted(() => ({ navigateToTab: vi.fn() }));
vi.mock("../../../lib/tabs", () => ({ useNavigateToTab: () => navigateToTab }));

// Signed out, so the job query only reads what a test seeds
vi.mock("../../auth/access-level", () => ({ useIsSignedIn: () => false }));

const team = vi.hoisted(() => ({
    settings: undefined as TeamSettings | undefined
}));
vi.mock("../../teams/queries", () => ({
    useCurrentTeamSettings: () => team.settings
}));

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
        replaced: [],
        stopFace: [],
        chosenScrewInputs: [],
        flipped: [],
        flipScrews: false
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    team.settings = undefined;
});

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

    it("picks circular edges by default, or faces with edges to exclude", async () => {
        renderPanel();
        expect(
            screen.getByText("Circular edges", { selector: "p" })
        ).toBeTruthy();
        expect(screen.queryByText("Edges to exclude")).toBeNull();

        await choose("Select by", "Faces");

        expect(screen.getByText("Edges to exclude")).toBeTruthy();
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

    it("replaces the screws picked, selected by Existing screws", async () => {
        renderPanel();
        await choose("Select by", "Existing screws");
        // Screws to replace is the only list, so it takes picks
        expect(
            screen.queryByText("Circular edges", { selector: "p" })
        ).toBeNull();
        select({ ...face("S"), entityType: "BODY" });
        expect(screen.getByText("Screw 1")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Insert" })).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Replace" }));
        expect(apiPost).toHaveBeenCalledWith("/auto-assembly/insert", {
            body: expect.objectContaining({
                selectionMode: SelectionMode.SCREWS,
                targets: [],
                replaced: [
                    {
                        occurrencePath: ["plate"],
                        entityId: "S",
                        entityType: "BODY"
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

    it("hides the vendor where the team requires Generic, and leaves Generic out where it bans it", async () => {
        team.settings = {
            ...DEFAULT_TEAM_SETTINGS,
            genericVendor: GenericVendorPolicy.REQUIRE
        };
        const { unmount } = renderPanel();
        await userEvent.click(
            screen.getByRole("checkbox", { name: "Add screw washer" })
        );
        expect(screen.queryByLabelText("Vendor")).toBeNull();
        unmount();

        team.settings = {
            ...DEFAULT_TEAM_SETTINGS,
            genericVendor: GenericVendorPolicy.BAN
        };
        renderPanel();
        await userEvent.click(screen.getAllByLabelText("Vendor")[0]);
        expect(screen.queryByRole("option", { name: "Generic" })).toBeNull();
        screen.getByRole("option", { name: "McMaster-Carr" });
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

    it("sizes the screw by the first hole picked, until Size is chosen by hand", async () => {
        const queryClient = createTestQueryClient();
        renderPanel(queryClient);
        await userEvent.click(
            screen.getByText("Circular edges", { selector: "p" })
        );
        select({ ...face("E"), entityType: "EDGE" });
        // What the panel sends the check, answered as a 1/4-20 hole
        const settled = settleChoices(
            FASTENER_SET,
            useAutoAssemblyStore.getState()
        );
        queryClient.setQueryData(
            pickCheckQueryKey({
                assembly: ASSEMBLY,
                selectionMode: SelectionMode.LOCATIONS,
                targets: toSelectedEntities(
                    useAutoAssemblyStore.getState().targets
                ),
                excluded: [],
                replaced: [],
                flipped: [],
                flipScrews: false,
                options: fastenerOptions(settled)
            }),
            { problems: [], holeSize: "QUARTER_20" }
        );
        await waitFor(() =>
            expect(useAutoAssemblyStore.getState().screw.size).toBe(
                "QUARTER_20"
            )
        );

        await choose("Size", "#8-32");
        useAutoAssemblyStore.getState().followScrew({ size: "QUARTER_20" });
        expect(useAutoAssemblyStore.getState().screw.size).toBe("NO_8_32");

        // Free to follow again once a run starts
        useAutoAssemblyStore.getState().finishRun();
        useAutoAssemblyStore.getState().followScrew({ size: "QUARTER_20" });
        expect(useAutoAssemblyStore.getState().screw.size).toBe("QUARTER_20");
    });

    it("takes the first existing screw picked as the screw, but what's chosen by hand", async () => {
        const queryClient = createTestQueryClient();
        renderPanel(queryClient);
        await choose("Select by", "Existing screws");
        select({ ...face("S"), entityType: "BODY" });
        await choose("Head", "Socket head");
        const settled = settleChoices(
            FASTENER_SET,
            useAutoAssemblyStore.getState()
        );
        queryClient.setQueryData(
            pickCheckQueryKey({
                assembly: ASSEMBLY,
                selectionMode: SelectionMode.SCREWS,
                targets: [],
                excluded: [],
                replaced: toSelectedEntities(
                    useAutoAssemblyStore.getState().replaced
                ),
                flipped: [],
                flipScrews: false,
                options: fastenerOptions(settled)
            }),
            {
                problems: [],
                existingScrew: { size: "NO_8_32", head: "BUTTON" }
            }
        );
        await waitFor(() =>
            expect(useAutoAssemblyStore.getState().screw.size).toBe("NO_8_32")
        );
        expect(useAutoAssemblyStore.getState().screw.head).toBe("SOCKET");
    });

    it("flips a circular edge from its row, and every screw to update with Flip screws", async () => {
        renderPanel();
        await userEvent.click(
            screen.getByText("Circular edges", { selector: "p" })
        );
        select(
            { ...face("E"), entityType: "EDGE" },
            { ...face("F"), entityType: "EDGE" }
        );
        const [flip] = within(
            screen.getByText("Edge 1").parentElement!
        ).getAllByRole("button");
        await userEvent.click(flip);
        await userEvent.click(insertButton());
        expect(apiPost).toHaveBeenLastCalledWith("/auto-assembly/insert", {
            body: expect.objectContaining({
                flipped: [
                    {
                        occurrencePath: ["plate"],
                        entityId: "E",
                        entityType: "EDGE"
                    }
                ],
                flipScrews: false
            })
        });

        await choose("Select by", "Existing screws");
        select({ ...face("S"), entityType: "BODY" });
        await userEvent.click(
            screen.getByRole("checkbox", { name: "Flip screws" })
        );
        await userEvent.click(screen.getByRole("button", { name: "Replace" }));
        expect(apiPost).toHaveBeenLastCalledWith("/auto-assembly/insert", {
            body: expect.objectContaining({ flipped: [], flipScrews: true })
        });
    });

    it("asks what to fasten before what to fasten with, each group folding from its header", async () => {
        renderPanel();
        const titles = [
            "Selections",
            "Fastener",
            "Length",
            "Add screw washer",
            "Add nut",
            "Add nut washer"
        ].map((title) => screen.getByText(title, { selector: "p, label" }));
        titles
            .slice(1)
            .forEach((title, index) =>
                expect(
                    titles[index].compareDocumentPosition(title) &
                        Node.DOCUMENT_POSITION_FOLLOWING
                ).toBeTruthy()
            );

        // Folded, its rows are hidden, not gone
        const sizing = () =>
            screen.queryByRole("textbox", { name: "Sizing" }) ??
            screen.queryByRole("combobox", { name: "Sizing" });
        expect(sizing()).toBeTruthy();
        await userEvent.click(screen.getByText("Fastener", { selector: "p" }));
        expect(sizing()).toBeNull();
    });

    it("ticks a group by its title, and folds it from its chevron", async () => {
        renderPanel();
        const nut = () =>
            screen.getByRole<HTMLInputElement>("checkbox", { name: "Add nut" });
        const type = () =>
            screen.queryByRole("textbox", { name: "Type" }) ??
            screen.queryByRole("combobox", { name: "Type" });
        await userEvent.click(screen.getByText("Add nut"));
        expect(nut().checked).toBe(false);
        expect(useAutoAssemblyStore.getState().added.nut).toBe(false);
        await userEvent.click(screen.getByText("Add nut"));
        expect(type()).toBeTruthy();

        const chevron = nut()
            .closest(".mantine-Accordion-item")
            ?.querySelector("[data-group-header]");
        await userEvent.click(chevron as HTMLElement);
        expect(nut().checked).toBe(true);
        expect(type()).toBeNull();
    });

    it("has no screw washer under a flat head", () => {
        useAutoAssemblyStore.setState({ screw: { head: "FLAT" } });
        renderPanel();
        expect(screen.queryByText("Add screw washer")).toBeNull();
    });

    it("stops an automatic screw by the condition chosen, asked in its own group, and a manual one not at all", async () => {
        renderPanel();
        expect(screen.queryByLabelText("Max length")).toBeNull();
        expect(screen.getByLabelText("Max thread depth")).toBeTruthy();
        // Asked before the washers and nut
        expect(
            screen
                .getByLabelText("Stop condition")
                .compareDocumentPosition(
                    screen.getByRole("checkbox", { name: "Add nut" })
                ) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();

        await choose("Stop condition", "Max length");
        expect(screen.getByLabelText("Max length")).toBeTruthy();

        await choose("Sizing", "Manual");
        expect(screen.queryByLabelText("Stop condition")).toBeNull();
        expect(screen.queryByLabelText("Max thread depth")).toBeNull();
    });

    it("stops at a planar face picked, and won't insert without one", async () => {
        renderPanel();
        await userEvent.click(
            screen.getByText("Circular edges", { selector: "p" })
        );
        select({ ...face("E"), entityType: "EDGE" });
        await choose("Stop condition", "Face");
        expect(insertButton().disabled).toBe(true);

        await userEvent.click(screen.getByText("Face to stop at"));
        select(face("P"), face("Q"));
        expect(screen.getByText("Face 1")).toBeTruthy();
        expect(screen.queryByText("Face 2")).toBeNull();
        await userEvent.click(insertButton());

        expect(apiPost).toHaveBeenCalledWith("/auto-assembly/insert", {
            body: expect.objectContaining({
                stopFace: {
                    occurrencePath: ["plate"],
                    entityId: "Q",
                    entityType: "FACE"
                },
                options: expect.objectContaining({ stop: StopCondition.FACE })
            })
        });
    });
});

describe("AutoAssemblyCallout", () => {
    const renderCallout = (insertableId: string, onOpen = vi.fn()) => {
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(FASTENER_SET_QUERY_KEY, FASTENER_SET);
        renderWithProviders(
            <AutoAssemblyCallout insertableId={insertableId} onOpen={onOpen} />,
            queryClient
        );
        return onOpen;
    };
    const launch = (elementType: string) =>
        useOnshapeLaunch.setState({
            documentId: "doc",
            instanceId: "ws",
            instanceType: "w",
            elementId: "asm",
            elementType: elementType as never
        });

    it("points a library nut inserted into an assembly at Auto Assembly, switching to it", async () => {
        launch("ASSEMBLY");
        const onOpen = renderCallout(
            FASTENER_SET.studios[FastenerKind.NUT].insertableId
        );
        expect(
            screen.getByText("Nuts are also available via Auto Assembly.")
        ).toBeTruthy();

        await userEvent.click(
            screen.getByRole("button", { name: "Auto Assembly" })
        );
        expect(onOpen).toHaveBeenCalled();
        expect(navigateToTab).toHaveBeenCalledWith(UtilityTab.AUTO_ASSEMBLY);
    });

    it("says nothing for another part, or in a Part Studio", () => {
        launch("ASSEMBLY");
        renderCallout("bracket-row");
        launch("PARTSTUDIO");
        renderCallout(FASTENER_SET.studios[FastenerKind.SCREW].insertableId);
        expect(
            screen.queryByText(/also available via Auto Assembly/)
        ).toBeNull();
    });
});

describe("JobDetails", () => {
    const edge = (id: string) => ({
        occurrencePath: ["plate"],
        entityId: id,
        entityType: SelectedEntityType.EDGE
    });

    it("warns on a step that left problems, and lists each pick with its own, lighting it up on hover", async () => {
        useOnshapeLaunch.setState({
            documentId: "doc",
            instanceId: "ws",
            instanceType: "w",
            elementId: "asm",
            elementType: "ASSEMBLY" as never
        });
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(assemblyJobQueryKey(ASSEMBLY), {
            state: AssemblyJobState.COMPLETE,
            tasks: [
                {
                    action: AssemblyTaskAction.INDEX,
                    state: AssemblyTaskState.DONE,
                    warning: "1 pick has a problem."
                },
                {
                    action: AssemblyTaskAction.INSERT,
                    state: AssemblyTaskState.DONE
                }
            ],
            picks: [
                { list: PickList.TARGETS, entity: edge("A") },
                {
                    list: PickList.TARGETS,
                    entity: edge("B"),
                    problem: {
                        message: "The 3/8 in screw is too long.",
                        severity: ProblemSeverity.WARNING
                    }
                }
            ],
            result: { inserted: 4, fastened: 4, replaced: 0 }
        });
        renderWithProviders(<JobDetails assembly={ASSEMBLY} />, queryClient);

        expect(screen.getByText("1 pick has a problem.")).toBeTruthy();
        expect(screen.getByText("Circular edges")).toBeTruthy();
        expect(screen.getByText("Edge 1")).toBeTruthy();
        expect(screen.getByText("The 3/8 in screw is too long.")).toBeTruthy();

        const posted = vi.spyOn(window.parent, "postMessage");
        await userEvent.hover(screen.getByText("Edge 2"));
        expect(posted).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    expect.objectContaining({
                        selectionId: "B",
                        occurrencePath: ["plate"]
                    })
                ]
            }),
            "*"
        );
    });

    it("lists each screw's steps, lighting up what one inserted on hover, and says it updated screws", async () => {
        useOnshapeLaunch.setState({
            documentId: "doc",
            instanceId: "ws",
            instanceType: "w",
            elementId: "asm",
            elementType: "ASSEMBLY" as never
        });
        const queryClient = createTestQueryClient();
        const done = (action: AssemblyTaskAction) => ({
            action,
            state: AssemblyTaskState.DONE
        });
        queryClient.setQueryData(assemblyJobQueryKey(ASSEMBLY), {
            state: AssemblyJobState.COMPLETE,
            tasks: [
                done(AssemblyTaskAction.INDEX),
                done(AssemblyTaskAction.REMOVE),
                done(AssemblyTaskAction.INSERT),
                done(AssemblyTaskAction.FASTEN)
            ],
            screws: [
                {
                    hole: "plate|E",
                    isUpdate: true,
                    parts: [
                        {
                            role: RunPartRole.NUT,
                            path: ["nut1"],
                            isFastened: false
                        },
                        {
                            role: RunPartRole.SCREW,
                            path: ["screw1"],
                            isFastened: true
                        }
                    ]
                }
            ],
            result: { inserted: 2, fastened: 1, replaced: 1 }
        });
        renderWithProviders(
            <>
                <JobDetailsTitle assembly={ASSEMBLY} />
                <JobDetails assembly={ASSEMBLY} />
            </>,
            queryClient
        );

        expect(screen.getByText("Updated 1 screw with problems")).toBeTruthy();
        expect(screen.getByText("Index holes")).toBeTruthy();
        expect(screen.getByText("Screw 1")).toBeTruthy();
        const steps = ["Delete screw", "Insert screw", "Add nut"].map((name) =>
            screen.getByText(name)
        );
        expect(
            steps[1].compareDocumentPosition(steps[2]) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            screen.getByText("Not fastened, so it sits unmated.")
        ).toBeTruthy();

        const posted = vi.spyOn(window.parent, "postMessage");
        await userEvent.hover(screen.getByText("Add nut"));
        expect(posted).toHaveBeenCalledWith(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    { selectionType: "OCCURRENCE", occurrencePath: ["nut1"] }
                ]
            }),
            "*"
        );
    });
});
