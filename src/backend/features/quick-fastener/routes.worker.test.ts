import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import * as Assemblies from "../../lib/onshape/endpoints/assemblies";
import * as Documents from "../../lib/onshape/endpoints/documents";
import * as PartStudios from "../../lib/onshape/endpoints/part-studios";
import { toTranslation } from "../../lib/onshape/objects/transform";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeFeatureScriptValue
} from "../../lib/onshape/types";
import { catalog, FastenerKind, Program } from "./catalog";
import {
    DEFAULT_MAX_LENGTH,
    FastenerMode,
    HoleEnd,
    HoleStatus,
    type QuickFastenerPlan,
    SelectedEntityType
} from "./contract";
import { type StudioSelection } from "./scan";

const app = createTestApp();
const INCH = 0.0254;

const ASSEMBLY = {
    documentId: "doc",
    instanceId: "ws",
    instanceType: "w" as const,
    elementId: "asm"
};

/** Two 1/4 in. plates stacked down from the origin, each in its own Part Studio. */
const DEFINITION: OnshapeAssemblyDefinition = {
    rootAssembly: {
        features: [],
        instances: [
            {
                id: "top",
                type: "Part",
                documentId: "doc",
                elementId: "topStudio",
                partId: "TOP"
            },
            {
                id: "bottom",
                type: "Part",
                documentId: "doc",
                elementId: "bottomStudio",
                partId: "BOTTOM"
            }
        ],
        occurrences: [
            { path: ["top"], transform: toTranslation([0, 0, 0]) },
            { path: ["bottom"], transform: toTranslation([0, 0, -0.25 * INCH]) }
        ]
    },
    parts: [],
    subAssemblies: []
};

// FeatureScript values, as the evaluation answers them
const fs = {
    number: (value: number) => ({ btType: "BTFSValueNumber-772", value }),
    string: (value: string) => ({ btType: "BTFSValueString-1422", value }),
    boolean: (value: boolean) => ({ btType: "BTFSValueBoolean-1195", value }),
    array: (values: OnshapeFeatureScriptValue[]) => ({
        btType: "BTFSValueArray-1499",
        value: values
    }),
    vector: (values: number[]) => fs.array(values.map(fs.number)),
    map: (entries: Record<string, OnshapeFeatureScriptValue>) => ({
        btType: "BTFSValueMap-2062",
        value: Object.entries(entries).map(([key, value]) => ({
            key: fs.string(key),
            value
        }))
    })
};

/** A plate's 0.201 in. hole, down from its top at its origin. */
function plateScan(partId: string, edges: string[] = []) {
    const hole = fs.map({
        faceId: fs.string(`${partId}-face`),
        origin: fs.vector([0, 0, 0]),
        direction: fs.vector([0, 0, -1]),
        radius: fs.number((0.201 * INCH) / 2),
        start: fs.number(0),
        end: fs.number(0.25 * INCH),
        closedAtStart: fs.boolean(false),
        closedAtEnd: fs.boolean(false),
        threaded: fs.boolean(false),
        edges: fs.array([
            fs.map({ id: fs.string(`${partId}-top`), at: fs.number(0) }),
            fs.map({
                id: fs.string(`${partId}-bottom`),
                at: fs.number(0.25 * INCH)
            })
        ])
    });
    const circles = edges.map((id) =>
        fs.map({
            id: fs.string(id),
            partId: fs.string(partId),
            center: fs.vector([0, 0, 0]),
            radius: fs.number((0.201 * INCH) / 2),
            normal: fs.vector([0, 0, 1])
        })
    );
    return fs.map({
        parts: fs.map({ [partId]: fs.map({ holes: fs.array([hole]) }) }),
        circles: fs.array(circles)
    });
}

const BODY = {
    assembly: ASSEMBLY,
    targets: [
        {
            occurrencePath: ["top"],
            entityId: "TOP-top",
            entityType: SelectedEntityType.EDGE
        }
    ],
    options: {
        program: Program.FRC,
        mode: FastenerMode.AUTOMATIC,
        vendor: "GENERIC",
        head: "BUTTON",
        headWasher: false,
        nutType: "NYLOCK",
        nutWasher: false,
        maxLength: DEFAULT_MAX_LENGTH,
        upToNext: false
    }
};

function post(path: string, body: unknown) {
    return app.request(`/api${path}`, jsonRequest("POST", body), env);
}

let scripts: string[];

beforeEach(async () => {
    scripts = [];
    // Each test starts uncached
    for (const key of (await env.KV.list({ prefix: "quick-fastener" })).keys) {
        await env.KV.delete(key.name);
    }
    vi.spyOn(Assemblies, "getAssembly").mockResolvedValue(DEFINITION);
    vi.spyOn(Documents, "getElements").mockResolvedValue([
        {
            id: "topStudio",
            name: "Top",
            elementType: "PARTSTUDIO",
            microversionId: "t1"
        },
        {
            id: "bottomStudio",
            name: "Bottom",
            elementType: "PARTSTUDIO",
            microversionId: "b1"
        }
    ] as Awaited<ReturnType<typeof Documents.getElements>>);
    vi.spyOn(PartStudios, "evaluateFeatureScript").mockImplementation(
        (_client, path, script) => {
            scripts.push(path.elementId);
            const picked: StudioSelection = {
                edges: script.includes('qTransient("TOP-top")')
                    ? ["TOP-top"]
                    : [],
                faces: []
            };
            return Promise.resolve({
                result:
                    path.elementId === "topStudio"
                        ? plateScan("TOP", picked.edges)
                        : plateScan("BOTTOM")
            });
        }
    );
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/quick-fastener/plan", () => {
    it("bolts through both plates, and caches what wasn't picked", async () => {
        const res = await post("/quick-fastener/plan", BODY);
        expect(res.status).toBe(200);
        const { holes } = await res.json<QuickFastenerPlan>();
        expect(holes).toHaveLength(1);
        expect(holes[0]).toMatchObject({
            key: "top|TOP-top",
            status: HoleStatus.READY,
            end: HoleEnd.THROUGH,
            screw: { size: "NO_10_32", length: "IN_0_875" },
            nut: { type: "NYLOCK" }
        });
        expect(scripts.sort()).toEqual(["bottomStudio", "topStudio"]);

        // The bottom plate's tab hasn't changed, so its scan is reused
        scripts = [];
        await post("/quick-fastener/plan", BODY);
        expect(scripts).toEqual(["topStudio"]);
    });

    it("refuses FTC, whose fasteners aren't in yet", async () => {
        const res = await post("/quick-fastener/plan", {
            ...BODY,
            options: { ...BODY.options, program: Program.FTC }
        });
        expect(res.status).toBe(400);
    });

    it("refuses an assembly outside a workspace, and ids that aren't ids", async () => {
        expect(
            (
                await post("/quick-fastener/plan", {
                    ...BODY,
                    assembly: { ...ASSEMBLY, instanceType: "v" }
                })
            ).status
        ).toBe(400);
        expect(
            (
                await post("/quick-fastener/plan", {
                    ...BODY,
                    targets: [{ ...BODY.targets[0], entityId: 'a"b' }]
                })
            ).status
        ).toBe(400);
    });
});

describe("POST /api/quick-fastener/insert", () => {
    const LOCATION = (elementId: string) => ({
        documentId: "lib",
        versionId: "libv",
        elementId
    });

    afterEach(() => {
        for (const kind of Object.values(FastenerKind)) {
            catalog.studios[kind].location = null;
        }
    });

    it("says so until the parts are published", async () => {
        const res = await post("/quick-fastener/insert", BODY);
        expect(res.status).toBe(503);
    });

    it("inserts the screw and nut, and fastens each to its edge", async () => {
        catalog.studios.screw.location = LOCATION("screwStudio");
        catalog.studios.nut.location = LOCATION("nutStudio");
        catalog.studios.washer.location = LOCATION("washerStudio");
        const insert = vi
            .spyOn(Assemblies, "insertTransformedInstances")
            .mockResolvedValue({
                insertInstanceResponses: [
                    { occurrences: [{ path: ["screw1"] }] },
                    { occurrences: [{ path: ["nut1"] }] }
                ]
            });
        vi.mocked(Assemblies.getAssembly).mockResolvedValueOnce(DEFINITION);
        vi.mocked(Assemblies.getAssembly).mockResolvedValueOnce({
            ...DEFINITION,
            parts: [
                {
                    ...LOCATION("screwStudio"),
                    documentVersion: "libv",
                    mateConnectors: [{ featureId: "screwMC" }]
                },
                {
                    ...LOCATION("nutStudio"),
                    documentVersion: "libv",
                    mateConnectors: [{ featureId: "nutMC" }]
                }
            ]
        });
        const mates = vi
            .spyOn(Assemblies, "addAssemblyFeature")
            .mockResolvedValue({ feature: { featureId: "mate" } });

        const res = await post("/quick-fastener/insert", BODY);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ inserted: 2 });

        const [, , groups] = insert.mock.calls[0];
        expect(groups.map((group) => group.instances[0])).toMatchObject([
            {
                elementId: "screwStudio",
                configuration: expect.stringContaining("length=IN_0_875")
            },
            {
                elementId: "nutStudio",
                configuration: expect.stringContaining("type=NYLOCK")
            }
        ]);
        const queries = mates.mock.calls.map(([, , feature]) =>
            JSON.stringify(feature)
        );
        expect(queries[0]).toContain('"featureId":"screwMC"');
        expect(queries[0]).toContain('"deterministicIds":["TOP-top"]');
        expect(queries[1]).toContain('"featureId":"nutMC"');
        expect(queries[1]).toContain('"deterministicIds":["BOTTOM-bottom"]');
    });
});
