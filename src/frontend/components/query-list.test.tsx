import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderWithProviders } from "../../__test_utils__/render";
import { CIRCULAR_EDGES, PLANAR_FACES } from "../lib/messages";
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
            filter={CIRCULAR_EDGES}
        />
    );
}

const edge = (id: string): OnshapeSelection => ({
    entityType: "EDGE",
    selectionId: id,
    occurrencePath: ["plate"]
});

/** As Onshape sends them: the whole selection, after each pick. */
function select(...picked: OnshapeSelection[]) {
    for (const pick of picked) {
        act(() => {
            const { shown, receive } = useOnshapeSelection.getState();
            receive([...shown, pick]);
        });
    }
}

let messages: unknown[];

beforeEach(() => {
    messages = [];
    useOnshapeSelection.setState({
        focused: undefined,
        shown: [],
        awaited: undefined
    });
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
        expect(screen.getByText("Holes")).toBeTruthy();

        await userEvent.click(screen.getByText("Holes"));
        expect(screen.getByText(PROMPT)).toBeTruthy();
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "showMessageBubble",
                message: PROMPT
            })
        );

        // The request clears what the window showed
        act(() => useOnshapeSelection.getState().receive([]));
        select(edge("B"), edge("B"));
        expect(screen.getByText("Edge 1")).toBeTruthy();
        expect(screen.queryByText("Edge 2")).toBeNull();
    });

    it("refuses picks it doesn't take, saying what it wants", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select({ ...edge("F"), entityType: "FACE" });
        expect(screen.getAllByText(PROMPT)).toHaveLength(1);
        expect(screen.queryByText("Face 1")).toBeNull();
    });

    it("limits picks in the Onshape window to its kind while it's focused", async () => {
        renderWithProviders(
            <>
                <Harness />
                <QueryList
                    id="faces"
                    label="Faces"
                    prompt="Select faces."
                    entities={[]}
                    onChange={() => undefined}
                    accepts={() => true}
                    filter={PLANAR_FACES}
                />
            </>
        );
        expect(messages).not.toContainEqual(
            expect.objectContaining({ messageName: "requestSelection" })
        );
        const [edges, faces] = [
            screen.getByText("Holes"),
            screen.getByText("Faces")
        ];

        await userEvent.click(edges);
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelection",
                entityTypeSpecifier: ["EDGE"],
                selectionTypeSpecifier: ["GEOMETRY"],
                geometryTypeSpecifier: ["CIRCLE"]
            })
        );

        messages = [];
        await userEvent.click(faces);
        const names = messages.map(
            (message) => (message as { messageName: string }).messageName
        );
        expect(names).toEqual([
            "showMessageBubble",
            "stopRequest",
            "requestSelection"
        ]);
        expect(messages[2]).toMatchObject({
            entityTypeSpecifier: ["FACE"],
            geometryTypeSpecifier: ["PLANE"]
        });
    });

    it("lights a row's entity up while hovered, and removes it", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
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
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: []
            })
        );
    });

    it("sends nothing as picks arrive, which Onshape already shows", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));

        messages = [];
        select(edge("A"), edge("B"));
        expect(messages).toEqual([]);
    });

    it("lights its picks up once the mouse leaves a row, and limits picks again when clicked", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"), edge("B"));
        const row = screen.getByText("Edge 1").parentElement!;
        await userEvent.hover(row);
        expect(messages.at(-1)).toMatchObject({
            messageName: "requestSelectionHighlight",
            selections: [{ selectionId: "A" }],
            entityTypeSpecifier: ["EDGE"]
        });
        expect(messages.at(-1)).not.toHaveProperty("geometryTypeSpecifier");

        messages = [];
        await userEvent.unhover(row);
        expect(messages).toEqual([
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    expect.objectContaining({ selectionId: "A" }),
                    expect.objectContaining({ selectionId: "B" })
                ]
            })
        ]);

        messages = [];
        await userEvent.click(screen.getByText("Edge 2"));
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelection",
                entityTypeSpecifier: ["EDGE"]
            })
        );
    });

    it("lights the focused list's picks up again after a row of another list", async () => {
        function Other() {
            const [entities, setEntities] = useState(() => [edge("X")]);
            return (
                <QueryList
                    id="other"
                    label="Other"
                    prompt="Other"
                    entities={entities}
                    onChange={setEntities}
                    accepts={() => true}
                    filter={CIRCULAR_EDGES}
                />
            );
        }
        renderWithProviders(
            <>
                <Harness />
                <Other />
            </>
        );
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"));
        const other = screen.getByText("Edge 1", {
            selector: "p",
            ignore: "[data-focused] *"
        }).parentElement!;
        await userEvent.hover(other);

        messages = [];
        await userEvent.unhover(other);
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [expect.objectContaining({ selectionId: "A" })]
            })
        );
    });

    it("lights nothing once the mouse leaves a row with no list focused", async () => {
        function Unfocused() {
            const [entities, setEntities] = useState(() => [edge("A")]);
            return (
                <QueryList
                    id="holes"
                    label="Holes"
                    prompt={PROMPT}
                    entities={entities}
                    onChange={setEntities}
                    accepts={() => true}
                    filter={CIRCULAR_EDGES}
                />
            );
        }
        renderWithProviders(<Unfocused />);
        const row = screen.getByText("Edge 1").parentElement!;
        await userEvent.hover(row);

        messages = [];
        await userEvent.unhover(row);
        expect(messages).toEqual([
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: []
            })
        ]);
    });

    it("drops what's deselected in the Onshape window", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"), edge("B"));

        act(() => useOnshapeSelection.getState().receive([edge("B")]));
        expect(screen.queryByText("Edge 2")).toBeNull();
        expect(screen.getByText("Edge 1")).toBeTruthy();
    });

    it("clears the Onshape window's selection with its picks, keeping them limited", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"));

        messages = [];
        await userEvent.click(screen.getByText("Clear"));
        expect(screen.queryByText("Edge 1")).toBeNull();
        expect(messages).toEqual([
            expect.objectContaining({
                messageName: "requestSelection",
                entityTypeSpecifier: ["EDGE"]
            })
        ]);
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
                    filter={CIRCULAR_EDGES}
                />
            </>
        );
        const [first, second] = [
            screen.getByText("Holes"),
            screen.getByText("Other")
        ];
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
