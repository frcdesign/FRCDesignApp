import { describe, expect, it, vi } from "vitest";
import { INSERT_LOCATION_SKETCH_ID, INSERT_LOCATION_SOURCE } from "./contract";
import { findInsertLocation, getInsertLocationTransform } from "./parse";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { type ElementPath } from "../../lib/onshape/path";
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

const ASSEMBLY_PATH: ElementPath = {
    documentId: "doc",
    instanceType: "w",
    instanceId: "ws",
    elementId: "asm"
};

/** A client whose every request is answered with `assembly`. */
function answering(assembly: OnshapeAssemblyDefinition): MockOnshapeApi {
    const api = new MockOnshapeApi();
    vi.spyOn(api, "get").mockResolvedValue(assembly);
    return api;
}

const findIn = (assembly: OnshapeAssemblyDefinition) =>
    findInsertLocation(answering(assembly), ASSEMBLY_PATH);

const transformIn = (assembly: OnshapeAssemblyDefinition, instanceId: string) =>
    getInsertLocationTransform(answering(assembly), ASSEMBLY_PATH, instanceId);

describe("findInsertLocation", () => {
    it("finds the sketch the app inserts, among other instances", async () => {
        const assembly = toAssembly([
            { id: "part", type: "Part" },
            MARKER,
            { id: "sub", type: "Assembly" }
        ]);
        expect(await findIn(assembly)).toBe("marker");
    });

    // An assembly can hold a marker inserted before the sketch was revised.
    it("matches whatever version the marker was inserted from", async () => {
        const assembly = toAssembly([
            { ...MARKER, documentVersion: "older" } as OnshapeAssemblyInstance
        ]);
        expect(await findIn(assembly)).toBe("marker");
    });

    it("ignores a suppressed marker, which nothing can insert at", async () => {
        expect(
            await findIn(toAssembly([{ ...MARKER, suppressed: true }]))
        ).toBeUndefined();
    });

    it("ignores a sketch inserted from some other tab", async () => {
        expect(
            await findIn(toAssembly([{ ...MARKER, elementId: "elsewhere" }]))
        ).toBeUndefined();
    });

    // The marker inserted from a version of the tab we no longer name, so the
    // sketch's own id is no longer what it was when the constant was written.
    it("matches a sketch id the constant does not name", async () => {
        const assembly = toAssembly([{ ...MARKER, featureId: "redrawn" }]);
        expect(await findIn(assembly)).toBe("marker");
    });

    // Onshape naming the tab only on the partStudioFeatures entry, which is the
    // shape the instance list alone cannot be matched against.
    it("finds a marker whose instance names only its feature", async () => {
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
        expect(await findIn(assembly)).toBe("marker");
    });

    it("ignores a feature inserted from some other tab's sketch", async () => {
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
        expect(await findIn(assembly)).toBeUndefined();
    });

    // An instance naming no feature at all, against a tab whose entry names no
    // feature either: nothing lines up, so nothing matches.
    it("does not pair an instance and an entry by what both leave out", async () => {
        const assembly = toAssembly([{ id: "part", type: "Part" }], undefined, [
            {
                documentId: INSERT_LOCATION_SOURCE.documentId,
                elementId: INSERT_LOCATION_SOURCE.elementId
            }
        ]);
        expect(await findIn(assembly)).toBeUndefined();
    });
});

describe("getInsertLocationTransform", () => {
    // prettier-ignore
    const transform = [
        1, 0, 0, -0.139,
        0, 1, 0, -0.026,
        0, 0, 1, 0.081,
        0, 0, 0, 1
    ];

    it("reads where a top-level instance has been dragged to", async () => {
        const assembly = toAssembly(
            [MARKER],
            [{ path: ["marker"], transform }]
        );
        expect(await transformIn(assembly, "marker")).toEqual(transform);
    });

    // A deeper path is the same instance inside a subassembly, which is a
    // different thing in a different place.
    it("ignores an occurrence nested under another instance", async () => {
        const assembly = toAssembly(
            [MARKER],
            [{ path: ["sub", "marker"], transform }]
        );
        expect(await transformIn(assembly, "marker")).toBeUndefined();
    });

    it("has no transform for an instance that is no longer there", async () => {
        expect(await transformIn(toAssembly([], []), "marker")).toBeUndefined();
    });
});
