import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMessageListener } from "./messages";
import { useOnshapeLaunch } from "./onshape-params";
import { onPick, useOnshapeSelection } from "./selection";

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
        useOnshapeSelection.setState({ focused: "list" });
        stopPicking = onPick("list", picked);
        renderHook(() => useMessageListener());
    });

    afterEach(() => {
        stopPicking();
        picked.mockReset();
        useOnshapeLaunch.setState({ server: undefined });
        useOnshapeSelection.setState({ focused: undefined });
    });

    it("hands picks to the focused list from SELECTION messages", () => {
        post({ messageName: "SELECTION", selections: [edge] });
        expect(picked).toHaveBeenCalledWith([
            {
                entityType: "EDGE",
                selectionId: "JHD",
                occurrencePath: ["plate"]
            }
        ]);
    });

    it("hands picks over from a selection request's answers too", () => {
        post({ messageId: "selection-1", selections: [edge] });
        expect(picked).toHaveBeenCalledOnce();
    });

    it("takes nothing from a highlight's answer", () => {
        post({ messageId: "highlight-selection-1", selections: [edge] });
        expect(picked).not.toHaveBeenCalled();
    });
});
