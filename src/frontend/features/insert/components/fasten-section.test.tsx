import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { SelectionMode } from "@backend/features/auto-assembly/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { ContextBar } from "../../../components/context-bar";
import { SelectingActionBar } from "../../../components/selecting-action-bar";
import { ParameterGrid } from "../../../components/parameter-input";
import { apiGet, apiPost } from "../../../lib/api-client";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { queryClient } from "../../../lib/query-client";
import {
    configurationQueryKey,
    insertLocationQueryKey
} from "../../../lib/query-keys";
import {
    type OnshapeSelection,
    useOnshapeSelection
} from "../../../lib/selection";
import { getUiState, updateUiState } from "../../../lib/ui-state";
import {
    clearFastenPicks,
    setFastenTargets,
    useFastenPicks
} from "../fasten-picks";
import { enumParam } from "../../../../__test_utils__/configuration-fixtures";
import { FastenMark } from "./fasten-mark";
import { InsertMenuContent } from "./insert-menu";
import { FastenSection } from "./fasten-section";

vi.mock("../../auth/access-level", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useIsSignedIn: () => true
}));

vi.mock("../../../lib/library", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useLibraryId: () => "frc-design-lib"
}));

vi.mock("../../../lib/api-client", () => ({
    apiGet: vi.fn(() => new Promise(() => undefined)),
    apiPost: vi.fn(() => Promise.resolve({ instanceId: "marker" }))
}));

const ASSEMBLY = {
    documentId: "doc",
    instanceId: "ws",
    instanceType: "w",
    elementId: "asm",
    elementType: ElementType.ASSEMBLY
} as const;

const SCREW: InsertableOut = {
    id: "ins",
    elementId: "el",
    groupId: "group",
    documentId: "lib",
    versionId: "ver",
    path: {
        documentId: "lib",
        instanceType: "v",
        instanceId: "ver",
        elementId: "el"
    },
    name: "Button head screw",
    microversionId: "mv",
    isVisible: true,
    supportsFasten: true,
    elementType: ElementType.PART_STUDIO,
    isConfigurable: true,
    vendors: []
};

const TUBE: InsertableOut = { ...SCREW, id: "tube", supportsFasten: false };

const edge = (selectionId: string): OnshapeSelection => ({
    entityType: "EDGE",
    selectionId,
    occurrencePath: ["base"]
});

const face = (selectionId: string): OnshapeSelection => ({
    entityType: "FACE",
    selectionId,
    occurrencePath: ["base"]
});

/** As the message listener hands each pick Onshape streams over. */
function selectInOnshape(...picked: OnshapeSelection[]) {
    for (const pick of picked) {
        act(() => {
            const { shown, receive } = useOnshapeSelection.getState();
            receive([...shown, pick]);
        });
    }
}

/** What the assembly answered about its insert location; unasked leaves it pending. */
function seedInsertLocation(instanceId?: string) {
    queryClient.setQueryData(insertLocationQueryKey(ASSEMBLY), { instanceId });
}

function renderInMenu(insertable: InsertableOut) {
    return renderWithProviders(
        <ParameterGrid>
            <FastenSection insertable={insertable} />
        </ParameterGrid>,
        queryClient
    );
}

function renderBar() {
    return renderWithProviders(<ContextBar isLibrary />, queryClient);
}

const preselection = () => screen.getByRole("button", { name: /Preselection/ });

describe("fasten picks", () => {
    beforeEach(() => {
        useOnshapeLaunch.setState({
            ...ASSEMBLY,
            server: "https://cad.onshape.com"
        });
        updateUiState({
            fasten: true,
            fastenSelectionMode: SelectionMode.LOCATIONS,
            openInsertableId: undefined
        });
    });

    afterEach(() => {
        queryClient.clear();
        vi.mocked(apiPost).mockClear();
        clearFastenPicks();
        useOnshapeSelection.setState({
            focused: undefined,
            active: undefined,
            isFinished: false,
            shown: [],
            awaited: undefined,
            filtering: undefined
        });
    });

    it("lists the circular edges picked in the insert menu, leaving out faces", () => {
        renderInMenu(SCREW);
        selectInOnshape(edge("JH1"), face("JF1"), edge("JH2"));

        expect(screen.getByText("Edge 2")).toBeTruthy();
        expect(screen.queryByText("Edge 3")).toBeNull();
    });

    it("picks faces, and edges to exclude, in faces mode", () => {
        updateUiState({ fastenSelectionMode: SelectionMode.FACES });
        renderInMenu(SCREW);
        selectInOnshape(face("JF1"), edge("JH1"));

        expect(useFastenPicks.getState().targets).toEqual([face("JF1")]);
        expect(screen.getByText("Edges to exclude")).toBeTruthy();
    });

    it("drops its lists once Fasten is unticked, and opens again when ticked", async () => {
        renderInMenu(SCREW);
        expect(screen.getByText("Select by")).toBeTruthy();

        await userEvent.click(screen.getByRole("checkbox"));
        expect(getUiState().fasten).toBe(false);
        expect(screen.queryByText("Select by")).toBeNull();

        await userEvent.click(screen.getByRole("checkbox"));
        expect(screen.getByText("Select by")).toBeTruthy();
    });

    it("keeps taking picks while folded from its header", async () => {
        renderInMenu(SCREW);
        const header = document.querySelector("[data-group-header]");
        await userEvent.click(header as HTMLElement);
        expect(screen.getByRole("checkbox", { name: "Fasten" })).toBeTruthy();

        selectInOnshape(edge("JH1"));
        expect(useFastenPicks.getState().targets).toEqual([edge("JH1")]);
    });

    it("marks a part that can fasten, filled while picks are held for it", async () => {
        const { unmount } = renderWithProviders(
            <>
                <FastenMark insertable={SCREW} />
                <FastenMark insertable={TUBE} />
            </>,
            queryClient
        );
        const mark = () => document.querySelector("svg")?.parentElement;
        expect(document.querySelectorAll("svg")).toHaveLength(1);
        await userEvent.hover(mark()!);
        expect(
            await screen.findByText("Can fasten to preselections")
        ).toBeTruthy();

        // As Preselection holds them
        act(() => setFastenTargets([edge("JH1"), edge("JH2")]));
        expect(mark()?.dataset.hasPicks).toBe("true");
        expect(
            await screen.findByText("Fastens to 2 preselections")
        ).toBeTruthy();
        unmount();

        useOnshapeLaunch.setState({ elementType: ElementType.PART_STUDIO });
        renderWithProviders(<FastenMark insertable={SCREW} />, queryClient);
        expect(document.querySelector("svg")).toBeNull();
    });

    it("groups the menu's configuration beside Fasten, and only there", async () => {
        const configuration = {
            parameters: [enumParam("size", ["small", "large"])],
            records: []
        };
        queryClient.setQueryData(
            configurationQueryKey("ins", "mv"),
            configuration
        );
        queryClient.setQueryData(
            configurationQueryKey("tube", "mv"),
            configuration
        );
        const menu = (insertable: InsertableOut) => (
            <InsertMenuContent
                insertable={insertable}
                onInsert={vi.fn()}
                source={"library" as never}
            />
        );
        const { unmount } = renderWithProviders(menu(SCREW), queryClient);
        const title = screen.getByText("Configuration");
        expect(
            title.compareDocumentPosition(screen.getByText("Fasten")) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        // Folded, its rows are hidden, not gone
        const size = () =>
            screen.queryByRole("textbox", { name: "size" }) ??
            screen.queryByRole("combobox", { name: "size" });
        expect(size()).toBeTruthy();
        await userEvent.click(title);
        expect(size()).toBeNull();
        unmount();

        renderWithProviders(menu(TUBE), queryClient);
        expect(screen.queryByText("Configuration")).toBeNull();
        expect(screen.getByLabelText("size")).toBeTruthy();
    });

    it("has no section for a part that can't fasten, or in a Part Studio", () => {
        const { unmount } = renderInMenu(TUBE);
        expect(screen.queryByText("Fasten")).toBeNull();
        unmount();

        useOnshapeLaunch.setState({ elementType: ElementType.PART_STUDIO });
        renderInMenu(SCREW);
        expect(screen.queryByText("Fasten")).toBeNull();
    });

    it("takes picks in the context bar while closed, and counts them on Preselection", () => {
        renderBar();
        selectInOnshape(edge("JH1"), edge("JH1"), edge("JH2"));

        expect(useFastenPicks.getState().targets).toEqual([
            edge("JH1"),
            edge("JH2")
        ]);
        expect(preselection().textContent).toContain("2");
    });

    it("starts selecting from Preselection, keeps the picks on Done and drops them on Cancel", async () => {
        renderBar();
        await userEvent.click(preselection());
        expect(useOnshapeSelection.getState().active).toBe(
            "insert-fasten-targets"
        );

        selectInOnshape(edge("JH1"));
        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(useOnshapeSelection.getState().active).toBeUndefined();
        expect(useFastenPicks.getState().targets).toEqual([edge("JH1")]);

        await userEvent.click(preselection());
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(useFastenPicks.getState().targets).toEqual([]);
    });

    it("closes Preselection when selecting is finished from the action bar", async () => {
        renderBar();
        await userEvent.click(preselection());
        expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();

        act(() => useOnshapeSelection.getState().finishSelecting());
        expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    });

    it("offers Add insert location in the bar only when the assembly has none", async () => {
        seedInsertLocation();
        const { unmount } = renderBar();
        await userEvent.click(
            screen.getByRole("button", { name: "Add insert location" })
        );
        expect(apiPost).toHaveBeenCalledWith("/insert-location", {
            body: { targetPath: ASSEMBLY }
        });
        unmount();

        seedInsertLocation("marker");
        renderBar();
        expect(
            screen.queryByRole("button", { name: "Add insert location" })
        ).toBeNull();
    });

    it("asks again on focus once its answer is old, offering Add insert location once the marker is gone", async () => {
        queryClient.setQueryData(
            insertLocationQueryKey(ASSEMBLY),
            { instanceId: "marker" },
            { updatedAt: Date.now() - 60 * 1000 }
        );
        vi.mocked(apiGet).mockResolvedValueOnce({ instanceId: undefined });
        renderBar();
        expect(
            screen.queryByRole("button", { name: "Add insert location" })
        ).toBeNull();

        act(() => {
            window.dispatchEvent(new Event("focus"));
        });

        expect(
            await screen.findByRole("button", { name: "Add insert location" })
        ).toBeTruthy();
        expect(apiGet).toHaveBeenCalledWith(
            "/insert-location",
            expect.anything()
        );
    });

    it("doesn't ask again on focus while its answer is fresh", () => {
        seedInsertLocation("marker");
        renderBar();
        const asked = vi.mocked(apiGet).mock.calls.length;
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(vi.mocked(apiGet).mock.calls).toHaveLength(asked);
    });

    it("hands the bar's picks to the insert menu while one is open", () => {
        const { rerender } = renderBar();
        selectInOnshape(edge("JH1"));

        act(() => updateUiState({ openInsertableId: SCREW.id }));
        rerender(
            <>
                <ContextBar isLibrary />
                <ParameterGrid>
                    <FastenSection insertable={SCREW} />
                </ParameterGrid>
            </>
        );
        expect(document.querySelectorAll("[data-focused]")).toHaveLength(1);
        selectInOnshape(edge("JH2"));
        expect(useFastenPicks.getState().targets).toEqual([
            edge("JH1"),
            edge("JH2")
        ]);
    });

    it("has no context bar on a utility's page, where a list limiting picks shows the selecting action bar", async () => {
        renderWithProviders(
            <>
                <ContextBar isLibrary={false} />
                <SelectingActionBar />
            </>,
            queryClient
        );
        expect(screen.queryByRole("button")).toBeNull();

        act(() => useOnshapeSelection.setState({ filtering: "selection-1" }));
        await userEvent.click(
            await screen.findByRole("button", { name: "Stop selecting" })
        );
        expect(useOnshapeSelection.getState().isFinished).toBe(true);
    });
});
