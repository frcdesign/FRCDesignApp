import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    MOCK_ONSHAPE_API,
    createTestApp,
    jsonRequest
} from "../../../__test_utils__";
import * as AssemblyEndpoints from "../../lib/onshape/endpoints/assemblies";
import {
    INSERT_LOCATION_SKETCH_ID,
    INSERT_LOCATION_SOURCE,
    type InsertLocationOut
} from "./contract";
import { type OnshapeAssemblyInstance } from "../../lib/onshape/types";

const targetPath = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

const targetQuery = new URLSearchParams(targetPath).toString();

const MARKER: OnshapeAssemblyInstance = {
    id: "marker",
    type: "Feature",
    documentId: INSERT_LOCATION_SOURCE.documentId,
    elementId: INSERT_LOCATION_SOURCE.elementId,
    featureId: INSERT_LOCATION_SKETCH_ID
};

function mockAssembly(instances: OnshapeAssemblyInstance[]) {
    return vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
        rootAssembly: { features: [], instances, occurrences: [] },
        parts: [],
        subAssemblies: []
    });
}

describe("insert location routes", () => {
    afterEach(() => vi.restoreAllMocks());

    it("GET names the assembly's insert location", async () => {
        mockAssembly([MARKER]);

        const res = await createTestApp().request(
            `/api/insert-location?${targetQuery}`,
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            instanceId: "marker"
        } satisfies InsertLocationOut);
    });

    it("GET answers null for an assembly without one", async () => {
        mockAssembly([{ id: "part", type: "Part" }]);

        const res = await createTestApp().request(
            `/api/insert-location?${targetQuery}`,
            jsonRequest("GET"),
            env
        );

        expect(await res.json()).toEqual({
            instanceId: null
        } satisfies InsertLocationOut);
    });

    it("GET requires a signed-in caller, the assembly being theirs", async () => {
        const res = await createTestApp({ signedIn: false }).request(
            `/api/insert-location?${targetQuery}`,
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(401);
    });

    it("POST inserts the marker sketch clear of the geometry", async () => {
        mockAssembly([]);
        vi.spyOn(AssemblyEndpoints, "getAssemblyBoundingBox").mockResolvedValue(
            { lowX: -1, lowY: -1, lowZ: -1, highX: 1, highY: 0.1, highZ: 1 }
        );
        const spy = vi
            .spyOn(AssemblyEndpoints, "addFeatureToAssembly")
            .mockResolvedValue({
                insertInstanceResponses: [
                    { occurrences: [{ path: ["new-marker"] }] }
                ]
            });

        const res = await createTestApp().request(
            "/api/insert-location",
            jsonRequest("POST", { targetPath }),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            instanceId: "new-marker"
        } satisfies InsertLocationOut);

        // Past the nearest face of the box, which is +y at 0.1.
        const transform = spy.mock.calls[0][4];
        expect(transform?.[7]).toBeCloseTo(0.11);
        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            INSERT_LOCATION_SOURCE,
            INSERT_LOCATION_SKETCH_ID,
            expect.anything()
        );
    });

    it("POST still adds a marker when the bounding box cannot be read", async () => {
        mockAssembly([]);
        vi.spyOn(AssemblyEndpoints, "getAssemblyBoundingBox").mockRejectedValue(
            new Error("no geometry")
        );
        const spy = vi
            .spyOn(AssemblyEndpoints, "addFeatureToAssembly")
            .mockResolvedValue({
                insertInstanceResponses: [
                    { occurrences: [{ path: ["new-marker"] }] }
                ]
            });

        const res = await createTestApp().request(
            "/api/insert-location",
            jsonRequest("POST", { targetPath }),
            env
        );

        expect(res.status).toBe(200);
        expect(spy.mock.calls[0][4]?.slice(3, 4)).toEqual([0]);
    });

    it("POST keeps the one already there rather than adding a second", async () => {
        mockAssembly([MARKER]);
        const spy = vi.spyOn(AssemblyEndpoints, "addFeatureToAssembly");

        const res = await createTestApp().request(
            "/api/insert-location",
            jsonRequest("POST", { targetPath }),
            env
        );

        expect(await res.json()).toEqual({
            instanceId: "marker"
        } satisfies InsertLocationOut);
        expect(spy).not.toHaveBeenCalled();
    });
});
