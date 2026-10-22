import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElementType } from "@backend/lib/onshape/element-type";
import { SelectionMode } from "@backend/features/quick-fastener/contract";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import {
    type OnshapeSelection,
    useOnshapeSelection
} from "../../../lib/selection";
import { updateUiState } from "../../../lib/ui-state";
import { clearFastenPicks, useFastenPicks } from "../fasten-picks";
import { FastenCircularEdgesStatus } from "./fasten-circular-edges-status";

vi.mock("../../hints/queries", () => ({ useHasSeenHint: () => true }));

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
        act(() => useOnshapeSelection.getState().receive([pick]));
    }
}

function renderStatus(supportsReplicate = false) {
    return renderWithProviders(
        <FastenCircularEdgesStatus supportsReplicate={supportsReplicate} />
    );
}

async function openCard() {
    const user = userEvent.setup();
    // The icon is the card's only target, wrapped in the span it listens on.
    await user.hover(document.querySelector("svg")!.closest("span")!);
    return user;
}

describe("FastenCircularEdgesStatus", () => {
    beforeEach(() => {
        useOnshapeLaunch.setState({
            documentId: "doc",
            instanceId: "ws",
            instanceType: "w",
            elementId: "asm",
            elementType: ElementType.ASSEMBLY,
            server: "https://cad.onshape.com"
        });
        updateUiState({
            fastenSelectionMode: SelectionMode.LOCATIONS,
            replicate: false
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearFastenPicks();
        useOnshapeSelection.setState({ focused: undefined });
    });

    it("takes the circular edges picked, leaving out faces", async () => {
        renderStatus();
        selectInOnshape(edge("JH1"), face("JF1"), edge("JH2"));
        await openCard();

        expect(screen.getByText("2 circular edges selected")).toBeTruthy();
        expect(screen.getByText("Edge 2")).toBeTruthy();
        expect(screen.queryByText("Edge 3")).toBeNull();
    });

    it("keeps taking picks with the card closed", () => {
        renderStatus();
        selectInOnshape(edge("JH1"), edge("JH1"), edge("JH2"));

        expect(useFastenPicks.getState().targets).toEqual([
            edge("JH1"),
            edge("JH2")
        ]);
    });

    it("picks faces, and the edges of holes to skip, in faces mode", async () => {
        updateUiState({ fastenSelectionMode: SelectionMode.FACES });
        renderStatus();
        selectInOnshape(face("JF1"), edge("JH1"));
        await openCard();

        expect(screen.getByText("1 face selected")).toBeTruthy();
        expect(screen.getByText("Holes to skip")).toBeTruthy();
    });

    it("offers to replicate only a part an editor allowed to", async () => {
        renderStatus();
        selectInOnshape(edge("JH1"), edge("JH2"));
        await openCard();
        expect(screen.queryByLabelText("Replicate")).toBeNull();
        expect(
            screen.getByText(
                "A part will be inserted and fastened to each selected edge."
            )
        ).toBeTruthy();
    });

    it("offers to replicate once there is more than one circular edge", async () => {
        renderStatus(true);
        selectInOnshape(edge("JH1"));
        await openCard();
        expect(screen.queryByLabelText("Replicate")).toBeNull();

        selectInOnshape(edge("JH2"));
        expect(screen.getByLabelText("Replicate")).toBeTruthy();
    });

    it("says how to fasten when nothing is selected", async () => {
        renderStatus();
        await openCard();
        expect(screen.getByText("No circular edges selected")).toBeTruthy();
        expect(
            screen.getByText(
                "Select edges to automatically fasten this part to."
            )
        ).toBeTruthy();
    });
});
