import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMessageListener } from "./messages";
import { useOnshapeLaunch } from "./onshape-params";
import { expectSelection, onPick, useOnshapeSelection } from "./selection";

const SERVER = "https://cad.onshape.com";

const edge = {
    selectionType: "ENTITY",
    entityType: "EDGE",
    selectionId: "JHD",
    occurrencePath: ["plate"]
};

function post(data: unknown) {
    act(() => {
        window.dispatchEvent(
            new MessageEvent("message", { origin: SERVER, data })
        );
    });
}

describe("useMessageListener", () => {
    const picked = vi.fn();
    let stopPicking: () => void;

    beforeEach(() => {
        useOnshapeLaunch.setState({ server: SERVER });
        useOnshapeSelection.setState({
            focused: "list",
            shown: [],
            awaited: undefined
        });
        stopPicking = onPick("list", picked);
        renderHook(() => useMessageListener());
    });

    afterEach(() => {
        stopPicking();
        picked.mockReset();
        useOnshapeLaunch.setState({ server: undefined });
        useOnshapeSelection.setState({
            focused: undefined,
            shown: [],
            awaited: undefined
        });
    });

    const picks = [
        { entityType: "EDGE", selectionId: "JHD", occurrencePath: ["plate"] }
    ];

    it("hands the focused list what a SELECTION message added", () => {
        post({ messageName: "SELECTION", selections: [edge] });
        expect(picked).toHaveBeenCalledWith({ added: picks, removed: [] });
    });

    it("hands it what was deselected, as Onshape sends the whole selection", () => {
        post({ messageName: "SELECTION", selections: [edge] });
        post({ messageName: "SELECTION", selections: [] });
        expect(picked).toHaveBeenLastCalledWith({ added: [], removed: picks });
    });

    it("follows a pending selection request's answers, which carry the selection in its place", () => {
        const answer = (selections: unknown[]) =>
            post({
                messageName: "REQUESTED_SELECTION",
                messageId: "selection-1",
                status: { statusCode: "PENDING" },
                selections
            });
        answer([]);
        answer([edge]);
        expect(picked).toHaveBeenLastCalledWith({ added: picks, removed: [] });
        answer([]);
        expect(picked).toHaveBeenLastCalledWith({ added: [], removed: picks });
    });

    it("follows a highlight's answers too, past what it lit up", () => {
        const answer = (rest: object) =>
            post({
                messageName: "REQUESTED_SELECTION_HIGHLIGHT",
                messageId: "highlight-selection-1",
                status: { statusCode: "PENDING" },
                ...rest
            });
        expectSelection(picks);
        answer({});
        answer({ selections: [edge] });
        expect(picked).not.toHaveBeenCalled();

        answer({ selections: [] });
        expect(picked).toHaveBeenCalledWith({ added: [], removed: picks });
    });

    it("lets the console send a message, addressed to the launching element", () => {
        const posted = vi
            .spyOn(window.parent, "postMessage")
            .mockImplementation(vi.fn());
        useOnshapeLaunch.setState({
            documentId: "doc",
            instanceId: "ws",
            instanceType: "w",
            elementId: "asm",
            elementType: "ASSEMBLY" as never
        });
        renderHook(() => useMessageListener());
        window.sendToOnshape?.({ messageName: "stopRequest" });
        expect(posted).toHaveBeenLastCalledWith(
            {
                messageName: "stopRequest",
                documentId: "doc",
                workspaceId: "ws",
                elementId: "asm"
            },
            "*"
        );
        posted.mockRestore();
        useOnshapeLaunch.setState({
            documentId: undefined,
            instanceId: undefined,
            instanceType: undefined,
            elementId: undefined,
            elementType: undefined
        });
    });

    it("takes nothing that a highlight made Onshape select", () => {
        post({ messageName: "SELECTION", selections: [edge] });
        picked.mockClear();
        expectSelection(picks);
        // Onshape clears the window, then shows what was highlighted
        post({ messageName: "SELECTION", selections: [] });
        post({ messageName: "SELECTION", selections: [edge] });
        expect(picked).not.toHaveBeenCalled();

        post({ messageName: "SELECTION", selections: [] });
        expect(picked).toHaveBeenCalledWith({ added: [], removed: picks });
    });
});
