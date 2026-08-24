import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { type ElementPath } from "../../lib/onshape/path";
import * as AssemblyEndpoints from "../../lib/onshape/endpoints/assemblies";
import * as DocumentEndpoints from "../../lib/onshape/endpoints/documents";
import { OnshapeElementType } from "../../lib/onshape/endpoints/documents";
import type { BoltHelperResult, EdgeSelection } from "./contract";

/** Features are only editable in a workspace, so the target is one. */
const TARGET_PATH: ElementPath = {
    documentId: "doc-test",
    instanceId: "w-test",
    instanceType: "w",
    elementId: "e-assembly"
};

const EDGES: EdgeSelection[] = [
    { selectionId: "JH1", occurrencePath: ["M1"] },
    { selectionId: "JH2", occurrencePath: [] }
];

function mockElement(elementType: OnshapeElementType) {
    return vi
        .spyOn(DocumentEndpoints, "getDocumentElement")
        .mockResolvedValue({ name: "Assembly 1", elementType });
}

function postBoltHelper(body: unknown, signedIn = true) {
    return createTestApp({ signedIn }).request(
        "/api/bolt-helper",
        jsonRequest("POST", body),
        env
    );
}

describe("POST /bolt-helper", () => {
    afterEach(() => vi.restoreAllMocks());

    it("adds a fasten mate per edge, mated to that edge's center", async () => {
        mockElement(OnshapeElementType.ASSEMBLY);
        const addFeature = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValueOnce({ feature: { featureId: "f1" } })
            .mockResolvedValueOnce({ feature: { featureId: "f2" } });

        const res = await postBoltHelper({
            targetPath: TARGET_PATH,
            edges: EDGES
        });
        expect(res.status).toBe(200);

        const body: BoltHelperResult = await res.json();
        expect(body.featureIds).toEqual(["f1", "f2"]);
        expect(body.elementName).toBe("Assembly 1");
        expect(addFeature).toHaveBeenCalledTimes(2);

        const feature = JSON.stringify(addFeature.mock.calls[0][2]);
        expect(feature).toContain('qTransient(\\"JH1\\")');
        expect(feature).toContain("CENTER");
        expect(feature).toContain("M1");
    });

    it("rejects a tab that is not an assembly", async () => {
        mockElement(OnshapeElementType.PART_STUDIO);

        const res = await postBoltHelper({
            targetPath: TARGET_PATH,
            edges: EDGES
        });
        expect(res.status).toBe(400);
    });

    it("rejects a version, which has no editable feature list", async () => {
        const res = await postBoltHelper({
            targetPath: { ...TARGET_PATH, instanceType: "v" },
            edges: EDGES
        });
        expect(res.status).toBe(400);
    });

    it("rejects a request with no edges selected", async () => {
        const res = await postBoltHelper({
            targetPath: TARGET_PATH,
            edges: []
        });
        expect(res.status).toBe(400);
    });

    it("requires a signed-in caller", async () => {
        const res = await postBoltHelper(
            { targetPath: TARGET_PATH, edges: EDGES },
            false
        );
        expect(res.status).toBe(401);
    });
});
