import { describe, expect, it } from "vitest";
import {
    COMPANION_SOURCE,
    parseCompanionReady,
    parseCompanionRequest
} from "./contract";

describe("parseCompanionRequest", () => {
    const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const meshes = { screw: new ArrayBuffer(4) };

    it("takes a show whose parts name meshes it carries", () => {
        const request = {
            source: COMPANION_SOURCE,
            type: "show-preview",
            meshes,
            parts: [{ mesh: "screw", transform: IDENTITY }]
        };

        expect(parseCompanionRequest(request)).toEqual(request);
    });

    it.each([
        ["another sender's message", { messageName: "SELECTION" }],
        ["an unknown type", { source: COMPANION_SOURCE, type: "explode" }],
        [
            "a part naming a mesh it doesn't carry",
            {
                source: COMPANION_SOURCE,
                type: "show-preview",
                meshes,
                parts: [{ mesh: "nut", transform: IDENTITY }]
            }
        ],
        [
            "a transform that isn't sixteen numbers",
            {
                source: COMPANION_SOURCE,
                type: "show-preview",
                meshes,
                parts: [{ mesh: "screw", transform: [1, 0, 0] }]
            }
        ],
        [
            "a mesh that isn't bytes",
            {
                source: COMPANION_SOURCE,
                type: "show-preview",
                meshes: { screw: "data" },
                parts: []
            }
        ]
    ])("refuses %s", (_name, data) => {
        expect(parseCompanionRequest(data)).toBeUndefined();
    });
});

describe("parseCompanionReady", () => {
    it("takes the Companion's answer, and nothing else", () => {
        const ready = { source: COMPANION_SOURCE, type: "ready", version: 1 };

        expect(parseCompanionReady(ready)).toEqual(ready);
        expect(parseCompanionReady({ ...ready, version: "1" })).toBeUndefined();
        expect(
            parseCompanionReady({ messageName: "SELECTION" })
        ).toBeUndefined();
    });
});
