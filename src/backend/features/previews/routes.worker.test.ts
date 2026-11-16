import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    TEST_PART_STUDIO_ID,
    createTestApp,
    resetDb,
    seedPartStudio
} from "../../../__test_utils__";
import { enumParam } from "../../../__test_utils__/configuration-fixtures";
import { getDb } from "../../db/client";
import { configurations } from "../../db/schema";
import * as PartStudioEndpoints from "../../lib/onshape/endpoints/part-studios";
import { decodePreviewMesh } from "./contract";
import { parsePreviewKey, previewKey } from "./store";

const db = getDb(env.DB);
const MICROVERSION = "mv-1";

const TRIANGLE_FACES = [
    {
        faces: [
            {
                facets: [
                    {
                        vertices: [
                            [0, 0, 0],
                            [1, 0, 0],
                            [0, 1, 0]
                        ],
                        normal: [0, 0, 1]
                    }
                ]
            }
        ]
    }
];

function get(configuration: string, microversionId = MICROVERSION) {
    const query = new URLSearchParams({
        microversionId,
        configuration,
        v: microversionId
    });
    return createTestApp().request(
        `/api/preview-mesh/insertable/${TEST_PART_STUDIO_ID}?${query}`,
        { method: "GET" },
        env
    );
}

function mockTessellation(faces: unknown = TRIANGLE_FACES) {
    return {
        faces: vi
            .spyOn(PartStudioEndpoints, "getTessellatedFaces")
            .mockResolvedValue(faces),
        edges: vi
            .spyOn(PartStudioEndpoints, "getTessellatedEdges")
            .mockResolvedValue([])
    };
}

describe("previewKey", () => {
    it("reads back the element and version it was written with", () => {
        expect(
            parsePreviewKey(previewKey("e1", MICROVERSION, "size=l/x"))
        ).toEqual({ elementId: "e1", microversionId: MICROVERSION });
        expect(parsePreviewKey(previewKey("e1", MICROVERSION, ""))).toEqual({
            elementId: "e1",
            microversionId: MICROVERSION
        });
    });
});

describe("GET /api/preview-mesh/insertable/:insertableId", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db, { microversionId: MICROVERSION });
        await db.insert(configurations).values({
            insertableId: TEST_PART_STUDIO_ID,
            parameters: [enumParam("size", ["s", "l"])]
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("tessellates a configuration once, then serves it from storage", async () => {
        const tessellation = mockTessellation();

        const first = await get("size=l");
        const second = await get("size=l");

        expect(first.status).toBe(200);
        expect(first.headers.get("Cache-Control")).toContain("immutable");
        const mesh = decodePreviewMesh(await second.arrayBuffer());
        expect(mesh?.indices).toHaveLength(3);
        expect(tessellation.faces).toHaveBeenCalledOnce();
        expect(tessellation.faces.mock.calls[0][2]).toEqual({ size: "l" });
    });

    it("asks Onshape for the defaults with no overrides", async () => {
        const tessellation = mockTessellation();

        const res = await get("");

        expect(res.status).toBe(200);
        expect(tessellation.edges.mock.calls[0][2]).toEqual({});
    });

    it("refuses a url naming another version", async () => {
        const tessellation = mockTessellation();

        const res = await get("size=l", "mv-old");

        expect(res.status).toBe(404);
        expect(tessellation.faces).not.toHaveBeenCalled();
    });

    it("stores nothing for an answer with no faces", async () => {
        mockTessellation([]);

        const res = await get("size=s");

        expect(res.status).toBe(404);
        const stored = await env.BLOB.list({ prefix: "previews/" });
        expect(stored.objects).toHaveLength(0);
    });
});
