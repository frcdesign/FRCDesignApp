import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    MOCK_ONSHAPE_API,
    createTestApp,
    jsonRequest
} from "../../../__test_utils__";
import * as AssemblyEndpoints from "../../lib/onshape/endpoints/assemblies";
import { INSERT_LOCATION_NAME, type InsertLocationOut } from "./contract";
import { type OnshapeAssemblyFeature } from "../../lib/onshape/types";

const targetPath = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

const targetQuery = new URLSearchParams(targetPath).toString();

function mockAssembly(features: OnshapeAssemblyFeature[]) {
    return vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
        rootAssembly: { features, instances: [] },
        parts: [],
        subAssemblies: []
    });
}

const INSERT_LOCATION: OnshapeAssemblyFeature = {
    id: "mc",
    featureType: "mateConnector",
    featureData: { name: INSERT_LOCATION_NAME }
};

describe("insert location routes", () => {
    afterEach(() => vi.restoreAllMocks());

    it("GET names the assembly's insert location", async () => {
        mockAssembly([INSERT_LOCATION]);

        const res = await createTestApp().request(
            `/api/insert-location?${targetQuery}`,
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            mateConnectorId: "mc"
        } satisfies InsertLocationOut);
    });

    it("GET answers null for an assembly without one", async () => {
        mockAssembly([{ id: "other", featureType: "mateConnector" }]);

        const res = await createTestApp().request(
            `/api/insert-location?${targetQuery}`,
            jsonRequest("GET"),
            env
        );

        expect(await res.json()).toEqual({
            mateConnectorId: null
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

    it("POST adds a mate connector named after the insert location", async () => {
        mockAssembly([]);
        const spy = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValue({ feature: { featureId: "new-mc" } });

        const res = await createTestApp().request(
            "/api/insert-location",
            jsonRequest("POST", { targetPath }),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            mateConnectorId: "new-mc"
        } satisfies InsertLocationOut);
        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            expect.objectContaining({
                btType: "BTMMateConnector-66",
                featureType: "mateConnector",
                name: INSERT_LOCATION_NAME
            })
        );
    });

    it("POST keeps the one already there rather than adding a second", async () => {
        mockAssembly([INSERT_LOCATION]);
        const spy = vi.spyOn(AssemblyEndpoints, "addAssemblyFeature");

        const res = await createTestApp().request(
            "/api/insert-location",
            jsonRequest("POST", { targetPath }),
            env
        );

        expect(await res.json()).toEqual({
            mateConnectorId: "mc"
        } satisfies InsertLocationOut);
        expect(spy).not.toHaveBeenCalled();
    });
});
