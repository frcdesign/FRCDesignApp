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
import { OnshapeRateLimitError } from "../../../lib/onshape/client";
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

    function toggleFasten(insertableId: string, supportsFasten: boolean) {
        return createTestApp().request(
            `/api/toggle-insert-and-fasten/library/${TEST_LIBRARY_ID}/insertable/${insertableId}`,
            jsonRequest("POST", { supportsFasten }),
            env
        );
    }

    function mockMateConnector() {
        return vi.spyOn(PartStudioEndpoints, "getFeatures").mockResolvedValue({
            features: [
                {
                    featureType: "mateConnector",
                    featureId: "mc1",
                    name: "Mate connector 1",
                    suppressed: false
                }
            ]
        });
    }

    it("POST /toggle-insert-and-fasten keeps an override that differs from detection", async () => {
        await seedPartStudio(db, { supportsFasten: true });
        mockMateConnector();

        expect((await toggleFasten(TEST_PART_STUDIO_ID, false)).status).toBe(
            200
        );

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row).toMatchObject({
            supportsFasten: false,
            fastenOverride: false,
            // Kept, so the card can offer it back.
            fastenInfo: { mateConnectorId: "mc1" }
        });
    });

    it("POST /toggle-insert-and-fasten drops the override on the detected default", async () => {
        await seedPartStudio(db, { fastenOverride: false });
        mockMateConnector();

        expect((await toggleFasten(TEST_PART_STUDIO_ID, true)).status).toBe(
            200
        );

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row).toMatchObject({
            supportsFasten: true,
            fastenOverride: null
        });
    });

    it("POST /toggle-insert-and-fasten refuses with no mate connector", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartStudioEndpoints, "getFeatures").mockResolvedValue({
            features: []
        });

        expect((await toggleFasten(TEST_PART_STUDIO_ID, true)).status).toBe(
            400
        );
        expect(
            (await readInsertable(TEST_PART_STUDIO_ID))?.supportsFasten
        ).toBe(false);
    });

    it("POST /toggle-insert-and-fasten turns an assembly on by override", async () => {
        await seedAssembly(db);
        vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue({
            rootAssembly: {
                features: [
                    {
                        featureType: "mateConnector",
                        id: "mc1",
                        featureData: { occurrence: [] }
                    }
                ],
                instances: []
            },
            parts: [],
            subAssemblies: []
        });

        expect((await toggleFasten(TEST_ASSEMBLY_ID, true)).status).toBe(200);
        expect(await readInsertable(TEST_ASSEMBLY_ID)).toMatchObject({
            supportsFasten: true,
            fastenOverride: true
        });

        // Off is an assembly's default, so turning it off clears the override.
        expect((await toggleFasten(TEST_ASSEMBLY_ID, false)).status).toBe(200);
        expect(await readInsertable(TEST_ASSEMBLY_ID)).toMatchObject({
            supportsFasten: false,
            fastenOverride: null,
            fastenInfo: null
        });
    });

    it("POST /toggle-insert-and-fasten clears a stale fasten issue", async () => {
        await seedPartStudio(db, {
            buildIssues: [
                { type: BuildIssueType.NO_VENDORS },
                { type: BuildIssueType.UNSTABLE_MATE_CONNECTOR }
            ]
        });
        mockMateConnector();

        await toggleFasten(TEST_PART_STUDIO_ID, false);

        expect(
            (await readInsertable(TEST_PART_STUDIO_ID))?.buildIssues
        ).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });

    it("POST /insert-as-rigid sets a part studio's flag", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/insert-as-rigid/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { insertAsRigid: true }),
            env
        );
        expect(res.status).toBe(200);
        expect((await readInsertable(TEST_PART_STUDIO_ID))?.insertAsRigid).toBe(
            true
        );
    });

    it("POST /insert-as-rigid refuses an assembly", async () => {
        await seedAssembly(db);

        const res = await createTestApp().request(
            `/api/insert-as-rigid/library/${TEST_LIBRARY_ID}/insertable/${TEST_ASSEMBLY_ID}`,
            jsonRequest("POST", { insertAsRigid: true }),
            env
        );
        expect(res.status).toBe(400);
    });

    it("POST /add-to-part-studio places at the mate connector when it fastens", async () => {
        await seedPartStudio(db, { supportsFasten: true });
        const spy = vi
            .spyOn(PartStudioEndpoints, "addPartStudioFeature")
            .mockResolvedValue({ feature: { featureId: "feat-1" } });

        await createTestApp().request(
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { targetPath }),
            env
        );

        expect(JSON.stringify(spy.mock.calls[0][2])).toContain(
            "AT_MATE_CONNECTOR"
        );
    });

    it("POST /add-to-assembly groups a rigid part studio's parts", async () => {
        await seedPartStudio(db, { insertAsRigid: true });
        vi.spyOn(AssemblyEndpoints, "addElementToAssembly").mockResolvedValue({
            insertInstanceResponses: [
                { occurrences: [{ path: ["o1"] }, { path: ["o2"] }] }
            ]
        });
        const feature = vi
            .spyOn(AssemblyEndpoints, "addAssemblyFeature")
            .mockResolvedValue({ feature: { featureId: "group-1" } });

        const res = await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { targetPath }),
            env
        );
        expect(res.status).toBe(200);
        // The group isn't a feature for the panel to open.
        const body: InsertOut = await res.json();
        expect(body.featureId).toBeUndefined();

        expect(feature).toHaveBeenCalledOnce();
        expect(feature.mock.calls[0][2]).toMatchObject({
            featureType: "mateGroup",
            parameters: [
                {
                    queries: [{ path: ["o1"] }, { path: ["o2"] }]
                }
            ]
        });
    });

    it("POST /add-to-assembly leaves a part studio not set rigid ungrouped", async () => {
        await seedPartStudio(db);
        vi.spyOn(AssemblyEndpoints, "addElementToAssembly").mockResolvedValue({
            insertInstanceResponses: [
                { occurrences: [{ path: ["o1"] }, { path: ["o2"] }] }
            ]
        });
        const feature = vi.spyOn(AssemblyEndpoints, "addAssemblyFeature");

        await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { targetPath }),
            env
        );
        expect(feature).not.toHaveBeenCalled();
    });

    it("POST /indexing applies a switch and exclusions in one reindex", async () => {
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
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                indexConfigurations: true,
                excludedParameterIds: ["finish"]
            }),
            env
        );
        expect(res.status).toBe(200);

        expect(await readInsertable(TEST_PART_STUDIO_ID)).toMatchObject({
            indexConfigurations: true,
            excludedParameterIds: ["finish"]
        });
        expect(parts).toHaveBeenCalledTimes(2);
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
    async function seedFastenable() {
        await seedAssembly(db);
        await db
            .update(insertables)
            .set({
                supportsFasten: true,
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

    it("POST /indexing indexes and forces the flag on", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p", partNumber: "PN-123" }
        ]);

        const res = await createTestApp().request(
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
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

    it("POST /indexing stores the exclusion and reindexes without it", async () => {
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
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
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

    it("POST /indexing leaves the flag off when indexing fails", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockRejectedValue(
            new OnshapeRateLimitError("rate limited", 450)
        );

        const res = await createTestApp().request(
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(429);
        const body: { message: string } = await res.json();
        expect(body.message).toContain("rate limit");

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.indexConfigurations).toBe(false);
        // Nothing was written, so no records survive.
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    it("POST /indexing clears the data when forcing off", async () => {
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
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        spy.mockClear();

        const res = await createTestApp().request(
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
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

    it("POST /indexing keeps indexing a custom part", async () => {
        await seedGroup(db);
        await seedInsertable(db, {
            name: "Custom Bracket",
            vendors: [Vendor.CUSTOM]
        });
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p" }
        ]);

        const res = await createTestApp().request(
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
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
    it("POST /indexing replaces stale part-number issues", async () => {
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
            `/api/indexing/library/${TEST_LIBRARY_ID}/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.buildIssues).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });
});
