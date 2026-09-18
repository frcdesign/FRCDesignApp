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
    occurrences?: { path: string[]; transform: number[] }[],
    partStudioFeatures?: OnshapeAssemblyDefinition["partStudioFeatures"]
): OnshapeAssemblyDefinition {
    return {
        rootAssembly: { features: [], instances, occurrences },
        parts: [],
        subAssemblies: [],
        partStudioFeatures
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

    // The marker inserted from a version of the tab we no longer name, so the
    // sketch's own id is no longer what it was when the constant was written.
    it("matches a sketch id the constant does not name", () => {
        const assembly = toAssembly([{ ...MARKER, featureId: "redrawn" }]);
        expect(findInsertLocationInstance(assembly)?.id).toBe("marker");
    });

    // Onshape naming the tab only on the partStudioFeatures entry, which is the
    // shape the instance list alone cannot be matched against.
    it("finds a marker whose instance names only its feature", () => {
        const assembly = toAssembly(
            [{ id: "marker", type: "Feature", featureId: "sketch" }],
            undefined,
            [
                {
                    documentId: INSERT_LOCATION_SOURCE.documentId,
                    elementId: INSERT_LOCATION_SOURCE.elementId,
                    featureId: "sketch"
                }
            ]
        );
        expect(findInsertLocationInstance(assembly)?.id).toBe("marker");
    });

    it("ignores a feature inserted from some other tab's sketch", () => {
        const assembly = toAssembly(
            [{ id: "other", type: "Feature", featureId: "sketch" }],
            undefined,
            [
                {
                    documentId: INSERT_LOCATION_SOURCE.documentId,
                    elementId: "elsewhere",
                    featureId: "sketch"
                }
            ]
        );
        expect(findInsertLocationInstance(assembly)).toBeUndefined();
    });

    // An instance naming no feature at all, against a tab whose entry names no
    // feature either: nothing lines up, so nothing matches.
    it("does not pair an instance and an entry by what both leave out", () => {
        const assembly = toAssembly([{ id: "part", type: "Part" }], undefined, [
            {
                documentId: INSERT_LOCATION_SOURCE.documentId,
                elementId: INSERT_LOCATION_SOURCE.elementId
            }
        ]);
        expect(findInsertLocationInstance(assembly)).toBeUndefined();
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
