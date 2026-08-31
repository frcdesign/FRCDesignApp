import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configurations, insertables } from "../../../db/schema";
import { ElementType } from "../../../lib/onshape/element-type";
import { Vendor } from "../vendors";
import { BuildIssueType } from "../../build-checker/issues";
import {
    MOCK_ONSHAPE_API,
    TEST_ASSEMBLY_ID,
    TEST_ASSEMBLY_PATH,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
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
import { enumParam } from "../../../../__test_utils__/configuration-fixtures";

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
        .where(eq(configurations.id, insertableId))
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
            `/api/toggle-insert-and-fasten/insertable/${TEST_PART_STUDIO_ID}`,
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

    // A half-built target used to reach Onshape as a nonsense URL and fail
    // opaquely; the boundary rejects it instead.
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

        const body: { featureId: string | null } = await res.json();
        expect(body.featureId).toBeNull();

        expect(spy).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            targetPath,
            TEST_ASSEMBLY_PATH, // sourcePath
            ElementType.ASSEMBLY, // elementType
            expect.anything() // options
        );
    });

    it("POST /index-configurations indexes and forces the flag on", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p", partNumber: "PN-123" }
        ]);

        const res = await createTestApp().request(
            `/api/index-configurations/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.indexConfigurations).toBe(true);

        // Nothing to configure, so the part data lands on the insertable and
        // no configurations row is manufactured to hold it.
        expect(row?.partMetadata).toEqual({
            partNumber: "PN-123",
            hasMultipleParts: false,
            isOpenComposite: false
        });
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    it("POST /index-configurations leaves the flag off when indexing fails", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockRejectedValue(
            new OnshapeRateLimitError("rate limited", 450)
        );

        const res = await createTestApp().request(
            `/api/index-configurations/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        // Surfaced to the client rather than silently enabling. How long to
        // wait is the loader's business; the caller is told to try again.
        expect(res.status).toBe(429);
        const body: { message: string } = await res.json();
        expect(body.message).toContain("rate limit");

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.indexConfigurations).toBe(false);
        // Nothing was written, so no records survive.
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    // Over the auto-index threshold nothing indexes unless an admin asks, so
    // turning force off there drops the records and the configuration row.
    it("POST /index-configurations clears the data when forcing off", async () => {
        await seedGroup(db);
        await seedInsertable(db);
        await db.insert(configurations).values({
            id: TEST_PART_STUDIO_ID,
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
            `/api/index-configurations/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        spy.mockClear();

        const res = await createTestApp().request(
            `/api/index-configurations/insertable/${TEST_PART_STUDIO_ID}`,
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

    // Nothing gates on vendors any more, so a part below the threshold indexes
    // whether or not anyone sells it.
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
            `/api/index-configurations/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: false }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.partMetadata).not.toBeNull();
        // Nobody sells it, so a missing part number is not worth flagging.
        expect(row?.buildIssues).toEqual([]);
    });

    // The route merges into the row's stored issues, so it has to clear the ones
    // indexing owns first, or a resolved issue would stick around forever.
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
            `/api/index-configurations/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { indexConfigurations: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        // The cap no longer applies, and the unrelated issue survives.
        expect(row?.buildIssues).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });
});
