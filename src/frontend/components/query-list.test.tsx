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
import { Status } from "../lib/status";
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
        // Said in Onshape, not under the list
        expect(screen.queryByText(PROMPT)).toBeNull();
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
        messages = [];
        select({ ...edge("F"), entityType: "FACE" });
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "showMessageBubble",
                message: PROMPT
            })
        );
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
        const { messageId } = messages.at(-1) as { messageId: string };

        messages = [];
        await userEvent.click(faces);
        const names = messages.map(
            (message) => (message as { messageName: string }).messageName
        );
        expect(names).toEqual([
            "stopRequest",
            "showMessageBubble",
            "requestSelection"
        ]);
        // The edges' request, by its id
        expect(messages[0]).toMatchObject({ messageId });
        expect(messages[1]).toMatchObject({ message: "Select faces." });
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

    it("lights its picks up once the mouse leaves its rows, and limits picks again when clicked", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"), edge("B"));
        const row = screen.getByText("Edge 1").parentElement!;
        await userEvent.hover(row);
        expect(messages.at(-1)).toMatchObject({
            messageName: "requestSelectionHighlight",
            selections: [{ selectionId: "A" }]
        });

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

        // What Onshape shows for the highlight isn't a pick
        act(() => useOnshapeSelection.getState().receive([]));
        act(() =>
            useOnshapeSelection.getState().receive([edge("A"), edge("B")])
        );
        expect(screen.getByText("Edge 2")).toBeTruthy();

        messages = [];
        await userEvent.click(screen.getByText("Edge 2"));
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelection",
                entityTypeSpecifier: ["EDGE"]
            })
        );
    });

    it("lights the focused list's picks up after a row of another list", async () => {
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
        expect(messages).toEqual([
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [expect.objectContaining({ selectionId: "A" })]
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

    it("clears the Onshape window's selection with its picks, prompting and limiting picks again", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"));

        messages = [];
        await userEvent.click(screen.getByText("Clear"));
        expect(screen.queryByText("Edge 1")).toBeNull();
        expect(messages).toEqual([
            expect.objectContaining({
                messageName: "showMessageBubble",
                message: PROMPT
            }),
            expect.objectContaining({
                messageName: "requestSelection",
                entityTypeSpecifier: ["EDGE"]
            })
        ]);
    });

    it("prompts again as lists show and hide, lighting its picks up if it has some", async () => {
        const Toggled = () => {
            const [shown, setShown] = useState(false);
            return (
                <>
                    <Harness />
                    <button onClick={() => setShown(!shown)}>Toggle</button>
                    {shown && (
                        <QueryList
                            id="faces"
                            label="Faces"
                            prompt="Select faces."
                            entities={[]}
                            onChange={() => undefined}
                            accepts={() => true}
                            filter={PLANAR_FACES}
                        />
                    )}
                </>
            );
        };
        renderWithProviders(<Toggled />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"));

        messages = [];
        await userEvent.click(screen.getByText("Toggle"));
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "showMessageBubble",
                message: PROMPT
            })
        );
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [expect.objectContaining({ selectionId: "A" })]
            })
        );
    });

    it("keeps its picks when a click in Onshape clears a highlight of them, lighting them up again", async () => {
        renderWithProviders(<Harness />);
        await userEvent.click(screen.getByText("Holes"));
        select(edge("A"), edge("B"));
        // Lit up as the mouse leaves its rows
        await userEvent.unhover(screen.getByText("Edge 1"));
        act(() =>
            useOnshapeSelection.getState().receive([edge("A"), edge("B")])
        );

        messages = [];
        act(() => useOnshapeSelection.getState().receive([]));
        expect(screen.getByText("Edge 2")).toBeTruthy();
        expect(messages).toContainEqual(
            expect.objectContaining({
                messageName: "requestSelectionHighlight",
                selections: [
                    expect.objectContaining({ selectionId: "A" }),
                    expect.objectContaining({ selectionId: "B" })
                ]
            })
        );
    });

    it("shows a spinner beside Clear while its rows are checked", () => {
        renderWithProviders(
            <QueryList
                id="holes"
                label="Holes"
                prompt={PROMPT}
                entities={[edge("A")]}
                onChange={() => undefined}
                accepts={() => true}
                filter={CIRCULAR_EDGES}
                isChecking
            />
        );
        expect(document.querySelector(".mantine-Loader-root")).toBeTruthy();
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

    it("focuses a form's first list, and returns to it once the focused list is gone", async () => {
        const list = (id: string, autoFocus = false) => (
            <QueryList
                id={id}
                label={id}
                prompt={id}
                entities={[]}
                onChange={() => undefined}
                accepts={() => true}
                filter={CIRCULAR_EDGES}
                autoFocus={autoFocus}
            />
        );
        const { rerender } = renderWithProviders(
            <>
                {list("first", true)}
                {list("second")}
            </>
        );
        expect(useOnshapeSelection.getState().focused).toBe("first");
        expect(messages).toContainEqual(
            expect.objectContaining({ messageName: "requestSelection" })
        );

        await userEvent.click(screen.getByText("second"));
        expect(useOnshapeSelection.getState().focused).toBe("second");

        rerender(list("first", true));
        expect(useOnshapeSelection.getState().focused).toBe("first");
    });

    it("marks a row with an error in red and a warning in yellow, with why under each", () => {
        renderWithProviders(
            <QueryList
                id="checked"
                label="Checked"
                prompt="Select edges."
                entities={[edge("A"), edge("B"), edge("C")]}
                onChange={() => undefined}
                accepts={() => true}
                filter={CIRCULAR_EDGES}
                problem={(entity) =>
                    entity.selectionId === "B"
                        ? {
                              message: "Not a circular edge.",
                              status: Status.ERROR
                          }
                        : entity.selectionId === "C"
                          ? { message: "Too long.", status: Status.WARNING }
                          : undefined
                }
            />
        );
        expect(screen.getByText("Not a circular edge.")).toBeTruthy();
        expect(screen.getByText("Too long.")).toBeTruthy();
        expect(screen.getByText("Edge 2").getAttribute("style")).toContain(
            "red"
        );
        expect(screen.getByText("Edge 3").getAttribute("style")).toContain(
            "yellow"
        );
        expect(
            screen.getByText("Edge 1").getAttribute("style") ?? ""
        ).not.toContain("red");
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

    it("takes a part picked, which Onshape sends as a BODY selection with no entity type", () => {
        expect(
            parseSelections({
                messageName: "REQUESTED_SELECTION",
                selections: [
                    {
                        selectionType: "BODY",
                        selectionId: "JHD",
                        occurrencePath: ["MqPZYE6jkMIvygncF"],
                        workspaceMicroversionId: "d387758a175b94d2bc97bee4"
                    }
                ]
            })
        ).toEqual([
            {
                entityType: "BODY",
                selectionId: "JHD",
                occurrencePath: ["MqPZYE6jkMIvygncF"]
            }
        ]);
    });
});
