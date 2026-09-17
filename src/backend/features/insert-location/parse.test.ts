import { describe, expect, it } from "vitest";
import { INSERT_LOCATION_SKETCH_ID, INSERT_LOCATION_SOURCE } from "./contract";
import { findInsertLocationInstance, getInstanceTransform } from "./parse";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";

const MARKER: OnshapeAssemblyInstance = {
    id: "marker",
    type: "Feature",
    documentId: INSERT_LOCATION_SOURCE.documentId,
    elementId: INSERT_LOCATION_SOURCE.elementId,
    featureId: INSERT_LOCATION_SKETCH_ID
};

function toAssembly(
    instances: OnshapeAssemblyInstance[],
    occurrences?: { path: string[]; transform: number[] }[]
): OnshapeAssemblyDefinition {
    return {
        rootAssembly: { features: [], instances, occurrences },
        parts: [],
        subAssemblies: []
    };
}

describe("findInsertLocationInstance", () => {
    it("finds the sketch the app inserts, among other instances", () => {
        const assembly = toAssembly([
            { id: "part", type: "Part" },
            MARKER,
            { id: "sub", type: "Assembly" }
        ]);
        expect(findInsertLocationInstance(assembly)?.id).toBe("marker");
    });

    // An assembly can hold a marker inserted before the sketch was revised.
    it("matches whatever version the marker was inserted from", () => {
        const assembly = toAssembly([
            { ...MARKER, documentVersion: "older" } as OnshapeAssemblyInstance
        ]);
        expect(findInsertLocationInstance(assembly)?.id).toBe("marker");
    });

    it("ignores a suppressed marker, which nothing can insert at", () => {
        expect(
            findInsertLocationInstance(
                toAssembly([{ ...MARKER, suppressed: true }])
            )
        ).toBeUndefined();
    });

    it("ignores a sketch inserted from some other tab", () => {
        expect(
            findInsertLocationInstance(
                toAssembly([{ ...MARKER, elementId: "elsewhere" }])
            )
        ).toBeUndefined();
    });
});

describe("getInstanceTransform", () => {
    // prettier-ignore
    const transform = [
        1, 0, 0, -0.139,
        0, 1, 0, -0.026,
        0, 0, 1, 0.081,
        0, 0, 0, 1
    ];

    it("reads where a top-level instance has been dragged to", () => {
        const assembly = toAssembly(
            [MARKER],
            [{ path: ["marker"], transform }]
        );
        expect(getInstanceTransform(assembly, "marker")).toEqual(transform);
    });

    // A deeper path is the same instance inside a subassembly, which is a
    // different thing in a different place.
    it("ignores an occurrence nested under another instance", () => {
        const assembly = toAssembly(
            [MARKER],
            [{ path: ["sub", "marker"], transform }]
        );
        expect(getInstanceTransform(assembly, "marker")).toBeUndefined();
    });

    it("has no transform for an instance that is no longer there", () => {
        expect(
            getInstanceTransform(toAssembly([], []), "marker")
        ).toBeUndefined();
    });
});
