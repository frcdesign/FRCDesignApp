import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configurations, insertables } from "../../../db/schema";
import { dailyConfigurationMetrics, events } from "../../analytics/schema";
import { InsertSource } from "../../analytics/usage";
import { ElementType } from "../../../lib/onshape/element-type";
import { Vendor } from "../vendors";
import type { InsertOut } from "../contract";
import { MateLocation } from "./fasten";
import { BuildIssueType } from "../../build-checker/issues";
import {
    MOCK_ONSHAPE_API,
    TEST_ASSEMBLY_ID,
    TEST_ASSEMBLY_PATH,
    TEST_LIBRARY_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedConfiguration,
    seedGroup,
    seedInsertable,
    seedPartStudio
} from "../../../../__test_utils__";
import { getDb } from "../../../db/client";
import * as PartStudioEndpoints from "../../../lib/onshape/endpoints/part-studios";
import * as AssemblyEndpoints from "../../../lib/onshape/endpoints/assemblies";
import * as PartsEndpoints from "../../../lib/onshape/endpoints/parts";
import * as Gather from "../../quick-fastener/gather";
import { OnshapeRateLimitError } from "../../../lib/onshape/client";
import { OnshapeFailure } from "../../../lib/onshape/failures";
import { AUTO_INDEX_THRESHOLD } from "../../configurations/combinations";
import {
    enumParam,
    quantityParam
} from "../../../../__test_utils__/configuration-fixtures";

const db = getDb(env.DB);

/** Reads back a seeded insertable to assert on what a route wrote. */
function readInsertable(insertableId: string) {
    return db
        .select()
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();
}

function readConfig(insertableId: string) {
    return db
        .select()
        .from(configurations)
        .where(eq(configurations.insertableId, insertableId))
        .get();
}

// The target element to insert into — must be an editable workspace ("w").
const targetPath = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

describe("insertable routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    afterEach(() => vi.restoreAllMocks());

    it("POST /toggle-insert-and-fasten can clear fasten support", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/toggle-insert-and-fasten/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { supportsFasten: false }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.supportsFasten).toBe(false);
        expect(row?.fastenInfo).toBeNull();
    });

    it("POST /add-to-part-studio inserts via the Onshape API", async () => {
        await seedPartStudio(db);
        const spy = vi
            .spyOn(PartStudioEndpoints, "addPartStudioFeature")
            .mockResolvedValue({ feature: { featureId: "feat-1" } });

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                targetPath,
                configuration: undefined,
                useMateConnector: false,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
        expect(res.status).toBe(200);

        const body: { featureId: string } = await res.json();
        expect(body.featureId).toBe("feat-1");

        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            expect.anything() // DerivedFeature payload
        );
    });

    it("POST /add-to-part-studio records the source it was sent", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartStudioEndpoints, "addPartStudioFeature").mockResolvedValue(
            { feature: { featureId: "feat-1" } }
        );

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                targetPath,
                configuration: undefined,
                useMateConnector: false,
                isFavorite: false,
                isQuickInsert: false,
                source: InsertSource.GROUP_SEARCH
            }),
            env
        );
        expect(res.status).toBe(200);

        const event = await db.select().from(events).get();
        expect(event?.source).toBe(InsertSource.GROUP_SEARCH);
    });

    it("POST /add-to-part-studio fills the selection it was not given", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        vi.spyOn(PartStudioEndpoints, "addPartStudioFeature").mockResolvedValue(
            { feature: { featureId: "feat-1" } }
        );

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                targetPath,
                useMateConnector: false,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
        expect(res.status).toBe(200);

        // TEST_PARAMETERS declares one boolean defaulting to "true".
        const values = await db.select().from(dailyConfigurationMetrics).all();
        expect(values).toHaveLength(1);
        expect(values[0]).toMatchObject({
            parameterId: "boolean",
            value: "true"
        });
    });

    // The feature dialog shows the typed expression, not its value.
    it("POST /add-to-part-studio derives with the expression that was typed", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        await db
            .update(configurations)
            .set({ parameters: [quantityParam("length")] })
            .where(eq(configurations.insertableId, TEST_PART_STUDIO_ID));
        const spy = vi
            .spyOn(PartStudioEndpoints, "addPartStudioFeature")
            .mockResolvedValue({ feature: { featureId: "feat-1" } });

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                targetPath,
                selection: { length: "(2 + 3) in" }
            }),
            env
        );
        expect(res.status).toBe(200);

        expect(JSON.stringify(spy.mock.calls[0][2])).toContain(
            '"expression":"(2 + 3) in"'
        );
    });

    it.each([
        ["a missing instance id", { documentId: "d", elementId: "e" }],
        [
            "an unknown instance type",
            {
                documentId: "d",
                instanceId: "i",
                instanceType: "x",
                elementId: "e"
            }
        ],
        ["no target at all", undefined]
    ])("POST /add-to-part-studio rejects %s", async (_label, targetPath) => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                targetPath,
                configuration: undefined,
                useMateConnector: false,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
        expect(res.status).toBe(400);
    });

    it("POST /add-to-assembly inserts via the Onshape API", async () => {
        await seedAssembly(db);
        const spy = vi
            .spyOn(AssemblyEndpoints, "addElementToAssembly")
            .mockResolvedValue({});

        const res = await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", {
                targetPath,
                configuration: undefined,
                fasten: false,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
        expect(res.status).toBe(200);

        const body: InsertOut = await res.json();
        expect(body.featureId).toBeUndefined();

        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            TEST_ASSEMBLY_PATH, // sourcePath
            ElementType.ASSEMBLY, // elementType
            expect.anything() // options
        );
    });

    it("POST /add-to-assembly lands the insert on the insert location", async () => {
        await seedAssembly(db);
        vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
            rootAssembly: {
                features: [],
                instances: [],
                occurrences: [
                    {
                        path: ["marker"],
                        // prettier-ignore
                        transform: [
                            1, 0, 0, 1,
                            0, 1, 0, 2,
                            0, 0, 1, 3,
                            0, 0, 0, 1
                        ]
                    }
                ]
            },
            parts: [],
            subAssemblies: []
        });
        const spy = vi
            .spyOn(AssemblyEndpoints, "addElementToAssembly")
            .mockResolvedValue({});

        const res = await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", {
                targetPath,
                fasten: false,
                insertLocationId: "marker"
            }),
            env
        );
        expect(res.status).toBe(200);

        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            TEST_ASSEMBLY_PATH,
            ElementType.ASSEMBLY,
            // prettier-ignore
            expect.objectContaining({
                transform: [
                    1, 0, 0, 1,
                    0, 1, 0, 2,
                    0, 0, 1, 3,
                    0, 0, 0, 1
                ]
            })
        );
    });

    // The marker can be deleted after the app opens.
    it("POST /add-to-assembly inserts at the origin when the location is gone", async () => {
        await seedAssembly(db);
        vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
            rootAssembly: { features: [], instances: [], occurrences: [] },
            parts: [],
            subAssemblies: []
        });
        const spy = vi
            .spyOn(AssemblyEndpoints, "addElementToAssembly")
            .mockResolvedValue({});

        const res = await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", {
                targetPath,
                fasten: false,
                insertLocationId: "marker"
            }),
            env
        );
        expect(res.status).toBe(200);

        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            TEST_ASSEMBLY_PATH,
            ElementType.ASSEMBLY,
            expect.objectContaining({ transform: undefined })
        );
    });

    // Onshape defaults what's left out, and a long enough configuration is refused.
    it.each([
        ["nothing when the selection is all defaults", { boolean: "true" }, ""],
        ["the override alone", { boolean: "false" }, "boolean=false"]
    ])(
        "POST /add-to-assembly sends %s",
        async (_label, selection, expected) => {
            await seedAssembly(db);
            await seedConfiguration(db, TEST_ASSEMBLY_ID);
            const spy = vi
                .spyOn(AssemblyEndpoints, "addElementToAssembly")
                .mockResolvedValue({});

            const res = await createTestApp().request(
                `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
                jsonRequest("POST", { targetPath, selection, fasten: false }),
                env
            );
            expect(res.status).toBe(200);

            expect(spy).toHaveBeenCalledWith(
                MOCK_ONSHAPE_API,
                targetPath,
                TEST_ASSEMBLY_PATH,
                ElementType.ASSEMBLY,
                expect.objectContaining({ configuration: expected })
            );
        }
    );

    // Onshape refuses a part studio's empty configuration, though not an assembly's.
    it("POST /add-to-assembly names one default for a part studio left on its defaults", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        const spy = vi
            .spyOn(AssemblyEndpoints, "addElementToAssembly")
            .mockResolvedValue({});

        await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { targetPath, selection: {}, fasten: false }),
            env
        );

        expect(spy.mock.calls[0][4]?.configuration).toBe("boolean=true");
    });

    it("POST /add-to-assembly sends a quantity as the expression typed", async () => {
        await seedAssembly(db);
        await seedConfiguration(db, TEST_ASSEMBLY_ID);
        await db
            .update(configurations)
            .set({ parameters: [quantityParam("length")] })
            .where(eq(configurations.insertableId, TEST_ASSEMBLY_ID));
        const spy = vi
            .spyOn(AssemblyEndpoints, "addElementToAssembly")
            .mockResolvedValue({});

        await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", {
                targetPath,
                selection: { length: "(2 + 3) in" },
                fasten: false
            }),
            env
        );

        expect(spy.mock.calls[0][4]?.configuration).toBe(
            "length=(2%20%2B%203)%20in"
        );
    });

    /** An assembly that supports insert-and-fasten, and a landed insert to fasten. */
    async function seedFastenable(supportsReplicate?: boolean) {
        await seedAssembly(db);
        await db
            .update(insertables)
            .set({
                supportsFasten: true,
                supportsReplicate,
                fastenInfo: {
                    mateConnectorId: "mc1",
                    mateLocation: MateLocation.Part,
                    path: ["p1"]
                }
            })
            .where(eq(insertables.id, TEST_ASSEMBLY_ID));
        vi.spyOn(AssemblyEndpoints, "addElementToAssembly").mockResolvedValue({
            insertInstanceResponses: [{ occurrences: [{ path: ["o1"] }] }]
        });
    }

    function insertIntoAssembly(fasten: boolean) {
        return createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", {
                targetPath,
                configuration: undefined,
                fasten,
                isFavorite: false,
                isQuickInsert: false
            }),
            env
        );
    }

    /** What the usage log recorded for the one insert these tests make. */
    function loggedInsert() {
        return db.select().from(events).get();
    }

    it("records an insert nobody asked to fasten as unfastened", async () => {
        await seedFastenable();

        expect((await insertIntoAssembly(false)).status).toBe(200);
        expect(await loggedInsert()).toMatchObject({ fasten: false });
    });

    it("records the fasten only once it has been built", async () => {
        await seedFastenable();
        vi.spyOn(AssemblyEndpoints, "addAssemblyFeature").mockResolvedValue({
            feature: { featureId: "f1" }
        });

        expect((await insertIntoAssembly(true)).status).toBe(200);
        expect(await loggedInsert()).toMatchObject({ fasten: true });
    });

    // The part is in the assembly either way.
    it("keeps the insert but drops the fasten when the mate fails", async () => {
        await seedFastenable();
        vi.spyOn(AssemblyEndpoints, "addAssemblyFeature").mockRejectedValue(
            new Error("mate failed")
        );

        expect((await insertIntoAssembly(true)).status).toBe(500);
        expect(await loggedInsert()).toMatchObject({ fasten: false });
    });

    it("keeps the insert when the part cannot fasten at all", async () => {
        await seedAssembly(db);
        vi.spyOn(AssemblyEndpoints, "addElementToAssembly").mockResolvedValue({
            insertInstanceResponses: [{ occurrences: [{ path: ["o1"] }] }]
        });

        expect((await insertIntoAssembly(true)).status).toBe(400);
        expect(await loggedInsert()).toMatchObject({ fasten: false });
    });

    function fastenToPicks(body: Record<string, unknown>) {
        return createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", { targetPath, fasten: true, ...body }),
            env
        );
    }

    const EDGE_PICKS = ["JH1", "JH2", "JH3"].map((entityId) => ({
        occurrencePath: ["base"],
        entityId,
        entityType: "EDGE"
    }));

    /** What `gather` finds for the picks: each edge, with these radii in metres. */
    function mockGather(radii: Record<string, number>) {
        return vi.spyOn(Gather, "gather").mockResolvedValue({
            circularEdges: Object.entries(radii).map(([edgeId, radius]) => ({
                key: `base|${edgeId}`,
                occurrencePath: ["base"],
                edgeId,
                center: [0, 0, 0],
                normal: [0, 0, 1],
                radius
            })),
            holes: [],
            placed: []
        });
    }

    /** Feature types in the order they were added. */
    function addedFeatureTypes(spy: { mock: { calls: unknown[][] } }) {
        return spy.mock.calls.map(
            (call) => (call[2] as { featureType: string }).featureType
        );
    }

    it("fastens one inserted instance to each circular edge", async () => {
        await seedFastenable();
        const gather = mockGather({ JH1: 0.0025, JH2: 0.0025, JH3: 0.004 });
        const addFeature = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValue({ feature: { featureId: "f1" } });

        const res = await fastenToPicks({ targets: EDGE_PICKS });
        expect(res.status).toBe(200);
        const body: InsertOut = await res.json();
        expect(body).toEqual({ fastenedCount: 3 });

        expect(gather.mock.calls[0][3]).toEqual(EDGE_PICKS);
        expect(AssemblyEndpoints.addElementToAssembly).toHaveBeenCalledTimes(3);
        expect(addedFeatureTypes(addFeature)).toEqual(["mate", "mate", "mate"]);

        const mate = JSON.stringify(addFeature.mock.calls[1][2]);
        expect(mate).toContain('"implicit":true');
        expect(mate).toContain('"inferenceType":"CENTER"');
        expect(mate).toContain('qTransient(\\"JH2\\")');
        expect(mate).toContain('"path":["base"]');
        expect(await loggedInsert()).toMatchObject({ fasten: true });
    });

    it("passes faces and the edges to skip through to the scan", async () => {
        await seedFastenable();
        const gather = mockGather({ JH1: 0.0025 });
        vi.spyOn(AssemblyEndpoints, "addAssemblyFeature").mockResolvedValue({
            feature: { featureId: "f1" }
        });
        const face = {
            occurrencePath: ["base"],
            entityId: "JF1",
            entityType: "FACE"
        };

        const res = await fastenToPicks({
            selectionMode: "faces",
            targets: [face],
            excluded: [EDGE_PICKS[1]]
        });
        expect(res.status).toBe(200);
        expect(gather.mock.calls[0].slice(3)).toEqual([
            [face],
            [EDGE_PICKS[1]]
        ]);
    });

    it("refuses faces picked as circular edges", async () => {
        await seedFastenable();
        const res = await fastenToPicks({
            targets: [{ ...EDGE_PICKS[0], entityType: "FACE" }]
        });
        expect(res.status).toBe(400);
        expect(AssemblyEndpoints.addElementToAssembly).not.toHaveBeenCalled();
    });

    it("inserts nothing when no circular edge is found in the picks", async () => {
        await seedFastenable();
        mockGather({});

        const res = await fastenToPicks({ targets: EDGE_PICKS });
        expect(res.status).toBe(400);
        expect(AssemblyEndpoints.addElementToAssembly).not.toHaveBeenCalled();
    });

    it("fastens and replicates once per edge diameter", async () => {
        await seedFastenable(true);
        mockGather({ JH1: 0.0025, JH2: 0.004, JH3: 0.0025000000001 });
        const addFeature = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValue({ feature: { featureId: "f1" } });

        const res = await fastenToPicks({
            targets: EDGE_PICKS,
            replicate: true
        });
        expect(res.status).toBe(200);

        expect(AssemblyEndpoints.addElementToAssembly).toHaveBeenCalledTimes(2);
        expect(addedFeatureTypes(addFeature)).toEqual([
            "mate",
            "replicate",
            "mate"
        ]);
        const features = addFeature.mock.calls.map((call) =>
            JSON.stringify(call[2])
        );
        expect(features[1]).toContain("JH3");
        expect(features[1]).not.toContain("JH1");
        expect(features[2]).toContain("JH2");
    });

    it("fastens an instance per edge for a part not allowed to replicate", async () => {
        await seedFastenable();
        mockGather({ JH1: 1, JH2: 1, JH3: 1 });
        const addFeature = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValue({ feature: { featureId: "f1" } });

        const res = await fastenToPicks({
            targets: EDGE_PICKS,
            replicate: true
        });
        expect(res.status).toBe(200);
        expect(addedFeatureTypes(addFeature)).toEqual(["mate", "mate", "mate"]);
    });

    it("fastens an instance per edge when Onshape refuses the replicate", async () => {
        await seedFastenable(true);
        mockGather({ JH1: 1, JH2: 1, JH3: 1 });
        const addFeature = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValueOnce({ feature: { featureId: "mate" } })
            .mockRejectedValueOnce(new Error("bad feature"))
            .mockResolvedValue({ feature: { featureId: "f" } });

        const res = await fastenToPicks({
            targets: EDGE_PICKS,
            replicate: true
        });
        expect(res.status).toBe(200);
        expect(addedFeatureTypes(addFeature)).toEqual([
            "mate",
            "replicate",
            "mate",
            "mate"
        ]);
    });

    it("POST /toggle-replicate records the editor's decision", async () => {
        await seedFastenable();

        const res = await createTestApp().request(
            `/api/toggle-replicate/library/${TEST_LIBRARY_ID}/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", { supportsReplicate: true }),
            env
        );
        expect(res.status).toBe(200);
        expect(
            (await readInsertable(TEST_ASSEMBLY_ID))?.supportsReplicate
        ).toBe(true);
    });

    it("POST /index-configurations indexes and forces the flag on", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p", partNumber: "PN-123" }
        ]);

        const res = await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.indexConfigurations).toBe(true);

        expect(row?.partMetadata).toEqual({
            partNumber: "PN-123",
            hasMultipleParts: false,
            isOpenComposite: false
        });
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    it("POST /excluded-parameters stores the exclusion and reindexes without it", async () => {
        await seedPartStudio(db);
        await db.insert(configurations).values({
            insertableId: TEST_PART_STUDIO_ID,
            parameters: [
                enumParam("size", ["s", "l"]),
                enumParam("finish", ["matte", "gloss"])
            ]
        });
        const parts = vi
            .spyOn(PartsEndpoints, "getParts")
            .mockResolvedValue([{ partId: "p", partNumber: "PN" }]);

        const res = await createTestApp().request(
            `/api/excluded-parameters/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { excludedParameterIds: ["finish"] }),
            env
        );
        expect(res.status).toBe(200);

        expect(
            (await readInsertable(TEST_PART_STUDIO_ID))?.excludedParameterIds
        ).toEqual(["finish"]);
        // The default, then size=l alone: finish rides its default.
        expect(parts).toHaveBeenCalledTimes(2);
        expect(
            (await readConfig(TEST_PART_STUDIO_ID))?.records.map(
                (record) => record.values
            )
        ).toEqual([{ size: "l" }]);
    });

    it("POST /index-configurations refuses a generated part, which indexes every configuration", async () => {
        await seedPartStudio(db);
        await db
            .update(insertables)
            .set({ generatedStudio: "fasteners/screw" })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));
        const getParts = vi.spyOn(PartsEndpoints, "getParts");

        const res = await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(400);
        expect(getParts).not.toHaveBeenCalled();
        expect(
            (await readInsertable(TEST_PART_STUDIO_ID))?.indexConfigurations
        ).toBe(false);
    });

    it("POST /index-configurations leaves the flag off when indexing fails", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockRejectedValue(
            new OnshapeRateLimitError("rate limited", 450)
        );

        const res = await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(429);
        const body: { message: string } = await res.json();
        expect(body.message).toBe(OnshapeFailure.RATE_LIMITED);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.indexConfigurations).toBe(false);
        // Nothing was written, so no records survive.
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    it("POST /index-configurations clears the data when forcing off", async () => {
        await seedGroup(db);
        await seedInsertable(db);
        await db.insert(configurations).values({
            insertableId: TEST_PART_STUDIO_ID,
            parameters: [
                enumParam(
                    "A",
                    Array.from(
                        { length: AUTO_INDEX_THRESHOLD },
                        (_, i) => `o${i}`
                    )
                )
            ]
        });
        const spy = vi
            .spyOn(PartsEndpoints, "getParts")
            .mockResolvedValue([{ partId: "p", partNumber: "PN-123" }]);
        await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        spy.mockClear();

        const res = await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: false }),
            env
        );
        expect(res.status).toBe(200);
        // Past the threshold it is not auto-eligible, so nothing is re-indexed.
        expect(spy).not.toHaveBeenCalled();

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.indexConfigurations).toBe(false);
        // The row stays to hold the parameters; only the records go.
        expect((await readConfig(TEST_PART_STUDIO_ID))?.records).toEqual([]);
    });

    it("POST /index-configurations keeps indexing a custom part", async () => {
        await seedGroup(db);
        await seedInsertable(db, {
            name: "Custom Bracket",
            vendors: [Vendor.CUSTOM]
        });
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p" }
        ]);

        const res = await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: false }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.partMetadata).not.toBeNull();
        // Nobody sells it, so a missing part number is not worth flagging.
        expect(row?.buildIssues).toEqual([]);
    });

    // Indexing's own issues are cleared before merging, or a resolved one sticks.
    it("POST /index-configurations replaces stale part-number issues", async () => {
        await seedPartStudio(db);
        await db
            .update(insertables)
            .set({
                buildIssues: [
                    { type: BuildIssueType.NO_VENDORS },
                    { type: BuildIssueType.CONFIGURATION_LIMIT_EXCEEDED }
                ]
            })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p", partNumber: "PN-123" }
        ]);

        const res = await createTestApp().request(
            `/api/index-configurations/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.buildIssues).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });
});
