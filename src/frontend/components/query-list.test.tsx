import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderWithProviders } from "../../__test_utils__/render";
import { useOnshapeLaunch } from "../lib/onshape-params";
import {
    parseSelections,
    useOnshapeSelection,
    type OnshapeSelection
} from "../lib/selection";
import { QueryList } from "./query-list";

const PROMPT = "Select edges.";

function Harness() {
    const [entities, setEntities] = useState<OnshapeSelection[]>([]);
    return (
        <QueryList
            id="holes"
            label="Holes"
            prompt={PROMPT}
            entities={entities}
            onChange={setEntities}
            accepts={(entity) => entity.entityType === "EDGE"}
        />
    );
}

const edge = (id: string): OnshapeSelection => ({
    entityType: "EDGE",
    selectionId: id,
    occurrencePath: ["plate"]
});

/** As Onshape streams them: each pick as it's made. */
function select(...picked: OnshapeSelection[]) {
    for (const pick of picked) {
        act(() => useOnshapeSelection.getState().receive([pick]));
    }
}

let messages: unknown[];

beforeEach(() => {
    messages = [];
    useOnshapeSelection.setState({ focused: undefined });
    useOnshapeLaunch.setState({
        documentId: "doc",
        instanceId: "ws",
        instanceType: "w",
        elementId: "asm",
        elementType: "ASSEMBLY" as never
    });
    vi.spyOn(window.parent, "postMessage").mockImplementation((message) => {
        messages.push(message);
    });
});

afterEach(() => vi.restoreAllMocks());

describe("QueryList", () => {
    it("takes nothing until it's focused, then each pick once", async () => {
        renderWithProviders(<Harness />);
        select(edge("A"));
        expect(screen.getByText("Click to select")).toBeTruthy();

        await userEvent.click(screen.getByText("Click to select"));
        expect(screen.getByText(PROMPT)).toBeTruthy();
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "showMessageBubble",
                message: PROMPT
            })
        );

        select(edge("B"), edge("B"));
        expect(screen.getByText("Edge 1")).toBeTruthy();
        expect(screen.queryByText("Edge 2")).toBeNull();
    });

    it("refuses picks it doesn't take, saying what it wants", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Click to select"));
        select({ ...edge("F"), entityType: "FACE" });
        expect(screen.getAllByText(PROMPT)).toHaveLength(2);
        expect(screen.queryByText("Face 1")).toBeNull();
    });

    it("lights a row's entity up while hovered, and removes it", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Click to select"));
        select(edge("A"));

        const row = screen.getByText("Edge 1").parentElement!;
        await userEvent.hover(row);
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    {
                        selectionType: "ENTITY",
                        entityType: "EDGE",
                        selectionId: "A",
                        occurrencePath: ["plate"]
                    }
                ]
            })
        );
        await userEvent.click(within(row).getByRole("button"));
        expect(screen.queryByText("Edge 1")).toBeNull();
        expect(messages).toContainEqual(
            expect.objectContaining({ messageName: "stopRequest" })
        );
    });

    it("hands picks to one list at a time", async () => {
        renderWithProviders(
            <>
                <Harness />
                <QueryList
                    id="other"
                    label="Other"
                    prompt="Other"
                    entities={[]}
                    onChange={() => undefined}
                    accepts={() => true}
                />
            </>
        );
        const [first, second] = screen.getAllByText("Click to select");
        await userEvent.click(first);
        await userEvent.click(second);
        select(edge("A"));
        expect(screen.queryByText("Edge 1")).toBeNull();
    });
});

describe("parseSelections", () => {
    it("keeps entities, and leaves out whole occurrences", () => {
        expect(
            parseSelections({
                messageName: "SELECTION",
                selections: [
                    {
                        selectionType: "ENTITY",
                        entityType: "EDGE",
                        selectionId: "JKB",
                        occurrencePath: ["M1"]
                    },
                    { selectionType: "OCCURRENCE", occurrencePath: ["M1"] }
                ]
            })
        ).toEqual([
            { entityType: "EDGE", selectionId: "JKB", occurrencePath: ["M1"] }
        ]);
        expect(parseSelections({ messageName: "SELECTION" })).toEqual([]);
    });
});
