import { env } from "cloudflare:workers";
import { introspectWorkflowInstance } from "cloudflare:test";
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { resetDb } from "../../../__test_utils__";
import type { OAuthApi } from "../../lib/onshape/client";
import * as Blobs from "../../lib/onshape/endpoints/blobs";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as Versions from "../../lib/onshape/endpoints/versions";
import {
    type OnshapeDocumentContents,
    type OnshapeElement,
    OnshapeElementType,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";
import * as BackgroundSessions from "../auth/background-sessions";
import * as ThumbnailStore from "../thumbnails/store";
import * as Registration from "../webhooks/registration";
import { FeatureScriptProblem, FeatureScriptsLoadState } from "./contract";
import { getLoadStatus } from "./load-status";
import type { LoadFeatureScriptsParams } from "./load-claim";
import { MANIFEST_TAB_NAME } from "./manifest";
import { featureScripts, featureScriptsDocument } from "./schema";
import { iconKey } from "./store";

const db = getDb(env.DB);
const DOCUMENT_ID = env.FEATURESCRIPTS_DOCUMENT_ID;

const { FEATURE_STUDIO, PART_STUDIO, BLOB } = OnshapeElementType;

function tab(
    id: string,
    elementType: OnshapeElementType,
    name = id,
    microversionId = `mv-${id}`
): OnshapeElement {
    return { id, name, elementType, microversionId };
}

const ref = (elementId: string): OnshapeFolderEntry => ({
    btType: OnshapeFolderEntryType.ELEMENT,
    elementId
});

const MANIFEST_FEATURE = {
    description: "Does a thing.",
    version: "1.0.0",
    sourceUrl: "https://github.com/robot-education/robot-code/blob/x"
};

/** Two features sharing an example in a folder, and one at the top level with none. */
function frontend(extrudeMicroversion = "mv-extrude"): {
    contents: OnshapeDocumentContents;
    manifest: object;
} {
    const elements = [
        tab("manifest", BLOB, MANIFEST_TAB_NAME),
        tab("extrude", FEATURE_STUDIO, "multiExtrude.fs", extrudeMicroversion),
        tab("revolve", FEATURE_STUDIO, "multiRevolve.fs"),
        tab("multi", PART_STUDIO, "Multi extrude"),
        tab("extrude-icon", BLOB, "Multi extrude icon.svg"),
        tab("frame", FEATURE_STUDIO, "robotFrame.fs")
    ];
    return {
        contents: {
            elements,
            folders: {
                btType: OnshapeFolderEntryType.GROUP,
                groups: [
                    ref("manifest"),
                    {
                        btType: OnshapeFolderEntryType.GROUP,
                        groupName: "Basic operations",
                        groups: [ref("extrude"), ref("revolve"), ref("multi")]
                    },
                    ref("extrude-icon"),
                    ref("frame")
                ]
            }
        },
        manifest: {
            schemaVersion: 1,
            features: [
                {
                    ...MANIFEST_FEATURE,
                    studioElementId: "extrude",
                    featureType: "multiExtrude",
                    name: "Multi extrude",
                    iconElementId: "extrude-icon"
                },
                {
                    ...MANIFEST_FEATURE,
                    studioElementId: "revolve",
                    featureType: "multiRevolve",
                    name: "Multi revolve",
                    iconElementId: null
                },
                {
                    ...MANIFEST_FEATURE,
                    studioElementId: "frame",
                    featureType: "robotFrame",
                    name: "Robot frame",
                    iconElementId: null
                }
            ]
        }
    };
}

let version: string;
/** The workspace: the manifest, examples and icons. */
let document: ReturnType<typeof frontend>;
/** The latest version's contents, where features are added from; the workspace's unless a test sets it. */
let versionContents: OnshapeDocumentContents | undefined;
let thumbnailUploads: string[];
let thumbnailInstances: string[];

async function runLoad(
    id: string,
    params: LoadFeatureScriptsParams = { force: false },
    status: "complete" | "errored" = "complete"
): Promise<void> {
    await using instance = await introspectWorkflowInstance(
        env.LOAD_FEATURESCRIPTS_WORKFLOW,
        id
    );
    await instance.modify(async (m) => {
        await m.disableSleeps();
    });
    await env.LOAD_FEATURESCRIPTS_WORKFLOW.create({ id, params });
    await instance.waitForStatus(status);
}

function readRows() {
    return db
        .select()
        .from(featureScripts)
        .orderBy(asc(featureScripts.sortOrder))
        .all();
}

describe("LoadFeatureScriptsWorkflow", () => {
    beforeEach(async () => {
        await resetDb(db);
        const { keys } = await env.KV.list();
        await Promise.all(keys.map((key) => env.KV.delete(key.name)));
        version = "v-1";
        document = frontend();
        versionContents = undefined;
        thumbnailUploads = [];
        thumbnailInstances = [];
        vi.spyOn(
            BackgroundSessions,
            "getBackgroundOnshapeApi"
        ).mockResolvedValue({} as OAuthApi);
        vi.spyOn(Documents, "getDocument").mockResolvedValue({
            id: DOCUMENT_ID,
            name: "Frontend",
            public: true,
            defaultWorkspace: { id: "w" }
        });
        vi.spyOn(Versions, "getLatestVersion").mockImplementation(() =>
            Promise.resolve({
                id: version,
                name: version,
                createdAt: new Date().toISOString()
            })
        );
        vi.spyOn(Documents, "getContents").mockImplementation((_api, path) =>
            Promise.resolve(
                path.instanceType === "v"
                    ? (versionContents ?? document.contents)
                    : document.contents
            )
        );
        vi.spyOn(Blobs, "downloadBlob").mockImplementation((_api, path) =>
            Promise.resolve(
                new Response(
                    path.elementId === "manifest"
                        ? JSON.stringify(document.manifest)
                        : "<svg/>"
                )
            )
        );
        vi.spyOn(ThumbnailStore, "uploadThumbnails").mockImplementation(
            (_bucket, _api, path, _workspace, microversionId) => {
                thumbnailUploads.push(path.elementId);
                thumbnailInstances.push(
                    `${path.instanceType}/${path.instanceId}`
                );
                return Promise.resolve(
                    ThumbnailStore.thumbnailUrls(path.elementId, microversionId)
                );
            }
        );
        vi.spyOn(Registration, "ensureWebhook").mockResolvedValue();
    });
    afterEach(() => vi.restoreAllMocks());

    it("loads what the manifest lists, with examples by name and place, and icons", async () => {
        await runLoad("first");

        expect(await getLoadStatus(env)).toMatchObject({
            state: FeatureScriptsLoadState.LOADED,
            versionName: "v-1",
            featureCount: 3,
            failedCount: 0
        });
        const rows = await readRows();
        expect(
            rows.map((row) => ({
                elementId: row.elementId,
                name: row.name,
                category: row.category,
                exampleElementId: row.exampleElementId,
                iconElementId: row.iconElementId,
                problems: row.problems,
                isVisible: row.isVisible
            }))
        ).toEqual([
            {
                elementId: "extrude",
                name: "Multi extrude",
                category: "Basic operations",
                exampleElementId: "multi",
                iconElementId: "extrude-icon",
                problems: [],
                isVisible: true
            },
            {
                elementId: "revolve",
                name: "Multi revolve",
                category: "Basic operations",
                exampleElementId: "multi",
                iconElementId: null,
                problems: [FeatureScriptProblem.NO_ICON],
                isVisible: true
            },
            {
                elementId: "frame",
                name: "Robot frame",
                category: null,
                exampleElementId: null,
                iconElementId: null,
                problems: [
                    FeatureScriptProblem.NO_EXAMPLE,
                    FeatureScriptProblem.NO_ICON
                ],
                isVisible: true
            }
        ]);
        // The shared example is rendered once, from the workspace.
        expect(thumbnailUploads).toEqual(["multi"]);
        expect(thumbnailInstances).toEqual(["w/w"]);
        expect(Blobs.downloadBlob).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                instanceType: "w",
                elementId: "manifest"
            })
        );
        expect(
            await env.BLOB.get(iconKey("extrude-icon", "mv-extrude-icon"))
        ).not.toBeNull();
        expect(await db.select().from(featureScriptsDocument).get()).toEqual({
            documentId: DOCUMENT_ID,
            versionId: "v-1",
            workspaceId: "w",
            cacheVersion: 1
        });
        expect(Registration.ensureWebhook).toHaveBeenCalled();
    });

    it("loads only what changed in a new version, keeping each feature's id and visibility", async () => {
        await runLoad("first");
        const [extrude] = await readRows();
        await db
            .update(featureScripts)
            .set({ isVisible: false })
            .where(eq(featureScripts.elementId, "extrude"));

        version = "v-2";
        document = frontend("mv-extrude-2");
        thumbnailUploads = [];
        await runLoad("second");

        const [after] = await readRows();
        expect(after).toMatchObject({
            id: extrude.id,
            microversionId: "mv-extrude-2",
            isVisible: false
        });
        // The example didn't change, so its thumbnail isn't asked for again.
        expect(thumbnailUploads).toEqual(["multi"]);
        expect(
            (await db.select().from(featureScriptsDocument).get())?.cacheVersion
        ).toBe(2);
    });

    it("reads a manifest edited in the workspace without a new version", async () => {
        await runLoad("first");
        document.manifest = {
            schemaVersion: 1,
            features: (
                document.manifest as { features: object[] }
            ).features.map((feature) => ({
                ...feature,
                description: "Does it better."
            }))
        };

        await runLoad("second");

        expect(await getLoadStatus(env)).toMatchObject({
            state: FeatureScriptsLoadState.LOADED,
            versionName: "v-1"
        });
        expect((await readRows()).map((row) => row.description)).toEqual([
            "Does it better.",
            "Does it better.",
            "Does it better."
        ]);
    });

    it("adds from the version, and leaves out a studio only the workspace has", async () => {
        versionContents = {
            ...document.contents,
            elements: document.contents.elements
                .filter((element) => element.id !== "frame")
                .map((element) =>
                    element.id === "extrude"
                        ? { ...element, microversionId: "mv-extrude-released" }
                        : element
                )
        };
        document = frontend("mv-extrude-edited");

        await runLoad("first");

        const rows = await readRows();
        expect(rows.map((row) => row.elementId)).toEqual([
            "extrude",
            "revolve"
        ]);
        expect(rows[0].microversionId).toBe("mv-extrude-released");
    });

    it("leaves the list alone when nothing changed", async () => {
        await runLoad("first");
        thumbnailUploads = [];

        await runLoad("again");

        expect(thumbnailUploads).toEqual([]);
        expect(await getLoadStatus(env)).toMatchObject({
            state: FeatureScriptsLoadState.UP_TO_DATE,
            versionName: "v-1",
            featureCount: 3
        });
        expect(
            (await db.select().from(featureScriptsDocument).get())?.cacheVersion
        ).toBe(1);
    });

    it("drops a feature the manifest no longer lists", async () => {
        await runLoad("first");
        version = "v-2";
        document.manifest = {
            schemaVersion: 1,
            features: (
                document.manifest as { features: { studioElementId: string }[] }
            ).features.filter((feature) => feature.studioElementId !== "frame")
        };

        await runLoad("second");

        expect((await readRows()).map((row) => row.elementId)).toEqual([
            "extrude",
            "revolve"
        ]);
    });

    it("changes nothing when the workspace has no manifest", async () => {
        document.contents = {
            ...document.contents,
            elements: document.contents.elements.filter(
                (element) => element.id !== "manifest"
            )
        };

        await runLoad("broken", { force: false }, "errored");

        expect(await readRows()).toEqual([]);
        expect(await getLoadStatus(env)).toMatchObject({
            state: FeatureScriptsLoadState.FAILED,
            versionName: "v-1",
            error: "The frontend document's workspace has no featurescripts.json"
        });
        expect(
            await db.select().from(featureScriptsDocument).get()
        ).toBeUndefined();
    });
});
