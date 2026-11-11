import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    MOCK_ONSHAPE_API,
    createTestApp,
    jsonRequest
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import * as PartStudioEndpoints from "../../lib/onshape/endpoints/part-studios";
import { INSERT_RETRY } from "../../lib/onshape/retry";
import {
    type AddFeatureScriptOut,
    type FeatureScriptFavoritesOut,
    FeatureScriptProblem,
    type FeatureScriptsOut
} from "./contract";
import { featureScripts, featureScriptsDocument } from "./schema";
import { iconKey } from "./store";

const db = getDb(env.DB);

const targetPath = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

async function seed() {
    await db.insert(featureScriptsDocument).values({
        documentId: "frontend",
        versionId: "v-1",
        cacheVersion: 3
    });
    await db.insert(featureScripts).values([
        {
            id: "frame",
            elementId: "e-frame",
            microversionId: "mv-frame",
            featureType: "robotFrame",
            name: "Robot frame",
            description: "Add tube along an edge.",
            exampleElementId: "e-frame-example",
            exampleMicroversionId: "mv-frame-example",
            iconElementId: "e-frame-icon",
            iconMicroversionId: "mv-frame-icon",
            category: "Parts",
            sortOrder: 1
        },
        {
            id: "belt",
            elementId: "e-belt",
            microversionId: "mv-belt",
            featureType: "robotBelt",
            name: "Robot belt",
            description: "Add a belt.",
            problems: [FeatureScriptProblem.NO_EXAMPLE],
            sortOrder: 0
        }
    ]);
}

describe("featurescripts routes", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("GET /featurescripts-version answers the cache version, 0 before a load", async () => {
        const app = createTestApp();
        const before = await app.request(
            "/api/featurescripts-version",
            {},
            env
        );
        expect(await before.json()).toEqual({ version: 0 });

        await seed();
        const after = await app.request("/api/featurescripts-version", {}, env);
        expect(await after.json()).toEqual({ version: 3 });
    });

    it("GET /featurescripts lists the features in tab order, without the absent", async () => {
        await seed();
        const res = await createTestApp().request(
            "/api/featurescripts?v=3",
            {},
            env
        );
        expect(res.status).toBe(200);
        const body: FeatureScriptsOut = await res.json();

        expect(body.documentId).toBe("frontend");
        expect(body.versionId).toBe("v-1");
        expect(body.features.map((feature) => feature.id)).toEqual([
            "belt",
            "frame"
        ]);
        expect(body.features[0]).toEqual({
            id: "belt",
            name: "Robot belt",
            description: "Add a belt.",
            problems: [FeatureScriptProblem.NO_EXAMPLE]
        });
        expect(body.features[1]).toMatchObject({
            category: "Parts",
            exampleElementId: "e-frame-example",
            iconUrl: "/api/featurescripts/icon/e-frame-icon?v=mv-frame-icon",
            problems: []
        });
    });

    it("GET /featurescripts/icon serves the stored SVG sandboxed, and 404s a missing one", async () => {
        const svg = "<svg xmlns='http://www.w3.org/2000/svg'/>";
        await env.BLOB.put(iconKey("e-icon", "mv-1"), svg);
        const app = createTestApp();

        const res = await app.request(
            "/api/featurescripts/icon/e-icon?v=mv-1",
            {},
            env
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
        expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
        expect(res.headers.get("Cache-Control")).toContain("immutable");
        expect(await res.text()).toBe(svg);

        const missing = await app.request(
            "/api/featurescripts/icon/e-icon?v=mv-2",
            {},
            env
        );
        expect(missing.status).toBe(404);
        expect(missing.headers.get("Cache-Control")).toContain("no-store");
    });

    it("POST /featurescripts/:id/add adds the feature from the loaded version", async () => {
        await seed();
        const spy = vi
            .spyOn(PartStudioEndpoints, "addPartStudioFeature")
            .mockResolvedValue({ feature: { featureId: "feat-1" } });

        const res = await createTestApp().request(
            "/api/featurescripts/frame/add",
            jsonRequest("POST", { targetPath }),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            featureId: "feat-1"
        } satisfies AddFeatureScriptOut);

        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            {
                btType: "BTMFeature-134",
                featureType: "robotFrame",
                name: "Robot frame",
                namespace: "dfrontend::vv-1::ee-frame::mmv-frame",
                parameters: []
            },
            INSERT_RETRY.timeoutMs
        );
    });

    it("POST /featurescripts/:id/add refuses a feature that isn't there, and a signed-out caller", async () => {
        await seed();
        const spy = vi.spyOn(PartStudioEndpoints, "addPartStudioFeature");

        const missing = await createTestApp().request(
            "/api/featurescripts/gone/add",
            jsonRequest("POST", { targetPath }),
            env
        );
        expect(missing.status).toBe(404);

        const signedOut = await createTestApp({
            signedIn: false,
            isAuthenticated: false
        }).request(
            "/api/featurescripts/frame/add",
            jsonRequest("POST", { targetPath }),
            env
        );
        expect(signedOut.status).toBe(401);
        expect(spy).not.toHaveBeenCalled();
    });

    it("favorites a feature once per caller, lists them oldest first, and unfavorites", async () => {
        await seed();
        const alice = createTestApp({ userId: "alice" });
        const bob = createTestApp({ userId: "bob" });
        const favorites = async (app: ReturnType<typeof createTestApp>) => {
            const res = await app.request(
                "/api/featurescripts/favorites",
                {},
                env
            );
            expect(res.headers.get("Cache-Control")).toContain("no-store");
            const body: FeatureScriptFavoritesOut = await res.json();
            return body.featureScriptIds;
        };

        for (const id of ["frame", "belt", "frame"]) {
            const res = await alice.request(
                `/api/featurescripts/${id}/favorite`,
                { method: "POST" },
                env
            );
            expect(res.status).toBe(200);
        }
        expect(await favorites(alice)).toEqual(["frame", "belt"]);
        expect(await favorites(bob)).toEqual([]);

        await alice.request(
            "/api/featurescripts/frame/favorite",
            { method: "DELETE" },
            env
        );
        expect(await favorites(alice)).toEqual(["belt"]);
    });

    it("refuses to favorite a feature that isn't there, and a signed-out caller", async () => {
        await seed();
        const missing = await createTestApp().request(
            "/api/featurescripts/gone/favorite",
            { method: "POST" },
            env
        );
        expect(missing.status).toBe(404);

        const signedOut = await createTestApp({
            signedIn: false,
            isAuthenticated: false
        }).request("/api/featurescripts/favorites", {}, env);
        expect(signedOut.status).toBe(401);
    });

    it("drops a feature's favorites with the feature", async () => {
        await seed();
        const app = createTestApp();
        await app.request(
            "/api/featurescripts/frame/favorite",
            { method: "POST" },
            env
        );
        await db.delete(featureScripts).where(eq(featureScripts.id, "frame"));

        const res = await app.request("/api/featurescripts/favorites", {}, env);
        expect(await res.json()).toEqual({ featureScriptIds: [] });
    });
});
