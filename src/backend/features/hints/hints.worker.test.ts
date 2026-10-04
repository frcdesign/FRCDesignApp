import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import * as AssemblyEndpoints from "../../lib/onshape/endpoints/assemblies";
import { type AccessData } from "../auth/access-level";
import { Hint } from "./contract";

const targetPath = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

async function seenHints(
    app: ReturnType<typeof createTestApp>
): Promise<Hint[]> {
    const res = await app.request(
        "/api/access-data/library/frc-design-lib",
        jsonRequest("GET"),
        env
    );
    const data: AccessData = await res.json();
    return data.seenHints;
}

beforeEach(async () => {
    await env.KV.delete("seen-hints:test-user");
});

afterEach(() => vi.restoreAllMocks());

describe("hints", () => {
    it("are recorded by the request that used the feature, and carried with access", async () => {
        vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
            rootAssembly: { features: [], instances: [], occurrences: [] },
            parts: [],
            subAssemblies: []
        });
        vi.spyOn(AssemblyEndpoints, "getAssemblyBoundingBox").mockRejectedValue(
            new Error("no geometry")
        );
        vi.spyOn(AssemblyEndpoints, "addFeatureToAssembly").mockResolvedValue({
            insertInstanceResponses: [{ occurrences: [{ path: ["marker"] }] }]
        });
        const app = createTestApp();
        expect(await seenHints(app)).toEqual([]);

        const added = await app.request(
            "/api/insert-location",
            jsonRequest("POST", { targetPath }),
            env
        );
        expect(added.status).toBe(200);

        expect(await seenHints(app)).toEqual([Hint.ADDED_INSERT_LOCATION]);
        // Another computer is the same user.
        expect(await seenHints(createTestApp())).toEqual([
            Hint.ADDED_INSERT_LOCATION
        ]);
    });

    it("are none while signed out", async () => {
        await env.KV.put(
            "seen-hints:test-user",
            JSON.stringify([Hint.USED_VERSION_MANAGER])
        );
        expect(await seenHints(createTestApp({ signedIn: false }))).toEqual([]);
    });
});
