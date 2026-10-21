import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElementType } from "@backend/lib/onshape/element-type";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import {
    setOnshapeSelections,
    useOnshapeSelection
} from "../../../lib/onshape-selection";
import { useMessageListener } from "../../../lib/messages";
import { updateUiState } from "../../../lib/ui-state";
import { FastenCirclesStatus } from "./fasten-circles-status";

vi.mock("../../hints/queries", () => ({ useHasSeenHint: () => true }));

const SERVER = "https://cad.onshape.com";

const edge = (selectionId: string) => ({
    selectionType: "ENTITY",
    selectionId,
    entityType: "EDGE",
    occurrencePath: ["base"]
});

/** The names of the messages sent to Onshape, in order. */
function sentMessages(postMessage: { mock: { calls: unknown[][] } }) {
    return postMessage.mock.calls.map(
        ([message]) => (message as { messageName: string }).messageName
    );
}

async function openCard(supportsReplicate = false) {
    const user = userEvent.setup();
    renderWithProviders(
        <FastenCirclesStatus supportsReplicate={supportsReplicate} />
    );
    // The icon is the card's only target, wrapped in the span it listens on.
    await user.hover(document.querySelector("svg")!.closest("span")!);
    return user;
}

describe("FastenCirclesStatus", () => {
    beforeEach(() => {
        useOnshapeLaunch.setState({
            documentId: "doc",
            instanceId: "ws",
            instanceType: "w",
            elementId: "asm",
            elementType: ElementType.ASSEMBLY,
            server: SERVER
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        setOnshapeSelections([]);
        updateUiState({ replicate: false });
    });

    it("lists the circles selected in Onshape, leaving out what isn't an edge", async () => {
        setOnshapeSelections([
            edge("JH1"),
            { selectionType: "ENTITY", selectionId: "JK1", entityType: "FACE" },
            edge("JH2")
        ]);
        await openCard();

        expect(screen.getByText("2 circles selected")).toBeTruthy();
        expect(screen.getByText("Circle 2")).toBeTruthy();
        expect(screen.queryByText("Circle 3")).toBeNull();
    });

    it("offers to replicate only a part an editor allowed to", async () => {
        setOnshapeSelections([edge("JH1"), edge("JH2")]);
        await openCard();
        expect(screen.queryByLabelText("Replicate")).toBeNull();
        expect(
            screen.getByText(
                "A part will be inserted and fastened to each selected circle."
            )
        ).toBeTruthy();
    });

    it("offers to replicate once there is more than one circle", async () => {
        setOnshapeSelections([edge("JH1")]);
        await openCard(true);
        expect(screen.queryByLabelText("Replicate")).toBeNull();

        act(() => setOnshapeSelections([edge("JH1"), edge("JH2")]));
        expect(screen.getByLabelText("Replicate")).toBeTruthy();
    });

    it("holds Onshape to circles while the field is active", async () => {
        const postMessage = vi.spyOn(window.parent, "postMessage");
        const user = await openCard();

        await user.click(screen.getByText("Click to select circles"));
        expect(sentMessages(postMessage)).toEqual([
            "showMessageBubble",
            "requestSelection"
        ]);
        expect(postMessage.mock.calls[1][0]).toMatchObject({
            geometryTypeSpecifier: ["CIRCLE"]
        });
        expect(screen.getByText("Select circles in Onshape")).toBeTruthy();

        fireEvent.pointerDown(document.body);
        expect(sentMessages(postMessage).at(-1)).toBe("stopRequest");
    });

    it("says how to fasten when nothing is selected", async () => {
        await openCard();
        expect(screen.getByText("No circles selected")).toBeTruthy();
    });
});

describe("useMessageListener", () => {
    afterEach(() => setOnshapeSelections([]));

    it("takes each selection message from Onshape as the whole selection", () => {
        useOnshapeLaunch.setState({ server: SERVER });
        renderHook(() => useMessageListener());

        const post = (data: unknown, origin = SERVER) =>
            act(() => {
                window.dispatchEvent(
                    new MessageEvent("message", { data, origin })
                );
            });

        post({
            messageName: "SELECTION",
            selections: [edge("JH1"), edge("JH2")]
        });
        expect(useOnshapeSelection.getState().selections).toHaveLength(2);

        post({ messageName: "SELECTION", selections: [edge("JH2")] });
        expect(useOnshapeSelection.getState().selections).toEqual([
            edge("JH2")
        ]);

        post(
            { messageName: "SELECTION", selections: [] },
            "https://elsewhere.example"
        );
        expect(useOnshapeSelection.getState().selections).toHaveLength(1);
    });
});
