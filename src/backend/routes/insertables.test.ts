import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configurations, insertables } from "../../shared/schema";
import { AccessLevel, ElementType } from "../../shared/types";
import { BuildIssueType } from "../../shared/build-checker";
import {
    MOCK_ONSHAPE_API,
    TEST_ASSEMBLY_ID,
    TEST_ASSEMBLY_PATH,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedAssembly,
    seedPartStudio
} from "../../__test_utils__";
import { getDb } from "../db";
import * as PartStudioEndpoints from "../onshape-api/endpoints/part-studios";
import * as AssemblyEndpoints from "../onshape-api/endpoints/assemblies";
import * as PartsEndpoints from "../onshape-api/endpoints/parts";
import { OnshapeRateLimitError } from "../onshape-api/onshape-api";

const db = getDb(env.DB);

/** Reads back a seeded insertable to assert on what a route wrote. */
function readInsertable(insertableId: string) {
    return db
        .select()
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();
}

/** Reads back an insertable's configuration row, if any. */
function readConfig(insertableId: string) {
    return db
        .select()
        .from(configurations)
        .where(eq(configurations.id, insertableId))
        .get();
}

// The target element to insert into — must be an editable workspace ("w").
const target = "/d/doc-target/w/w-target/e/target-element";
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

    it("POST /toggle-open-composite toggles the flag (admin only)", async () => {
        await seedPartStudio(db);

        const res = await createTestApp().request(
            `/api/toggle-open-composite/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { isOpenComposite: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.isOpenComposite).toBe(true);
    });

    it("POST /toggle-open-composite is forbidden without admin access", async () => {
        await seedPartStudio(db);
        const res = await createTestApp({
            accessLevel: AccessLevel.USER
        }).request(
            `/api/toggle-open-composite/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { isOpenComposite: true }),
            env
        );
        expect(res.status).toBe(403);
    });

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
            `/api/add-to-part-studio/insertable/${TEST_PART_STUDIO_ID}${target}`,
            jsonRequest("POST", {
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

    it("POST /add-to-assembly inserts via the Onshape API", async () => {
        await seedAssembly(db);
        const spy = vi
            .spyOn(AssemblyEndpoints, "addElementToAssembly")
            .mockResolvedValue({});

        const res = await createTestApp().request(
            `/api/add-to-assembly/insertable/${TEST_ASSEMBLY_ID}${target}`,
            jsonRequest("POST", {
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

    it("POST /toggle-part-number-search indexes and forces the flag on", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p", partNumber: "PN-123" }
        ]);

        const res = await createTestApp().request(
            `/api/toggle-part-number-search/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { forceIndex: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.forceIndex).toBe(true);

        const config = await readConfig(TEST_PART_STUDIO_ID);
        expect(config?.records).toEqual([
            {
                configuration: {},
                partNumber: "PN-123",
                name: null,
                description: null,
                material: null,
                vendor: null,
                hasMultipleParts: false
            }
        ]);
    });

    it("POST /toggle-part-number-search leaves the flag off when indexing fails", async () => {
        await seedPartStudio(db);
        vi.spyOn(PartsEndpoints, "getParts").mockRejectedValue(
            new OnshapeRateLimitError("rate limited", 450)
        );

        const res = await createTestApp().request(
            `/api/toggle-part-number-search/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { forceIndex: true }),
            env
        );
        // Surfaced to the client rather than silently enabling.
        expect(res.status).toBe(429);
        const body: { retryAfterSeconds: number } = await res.json();
        expect(body.retryAfterSeconds).toBe(450);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.forceIndex).toBe(false);
        // Nothing was written, so no records survive.
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    // Turning force off on a part with no vendor drops it below the auto-index
    // heuristic, so its records and configuration row go away.
    it("POST /toggle-part-number-search clears the data when forcing off", async () => {
        await seedPartStudio(db);
        const spy = vi
            .spyOn(PartsEndpoints, "getParts")
            .mockResolvedValue([{ partId: "p", partNumber: "PN-123" }]);
        await createTestApp().request(
            `/api/toggle-part-number-search/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { forceIndex: true }),
            env
        );
        spy.mockClear();

        const res = await createTestApp().request(
            `/api/toggle-part-number-search/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { forceIndex: false }),
            env
        );
        expect(res.status).toBe(200);
        // A part with no vendor isn't auto-eligible, so nothing is re-indexed.
        expect(spy).not.toHaveBeenCalled();

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        expect(row?.forceIndex).toBe(false);
        expect(await readConfig(TEST_PART_STUDIO_ID)).toBeUndefined();
    });

    // The route merges into the row's stored issues, so it has to clear the ones
    // indexing owns first, or a resolved issue would stick around forever.
    it("POST /toggle-part-number-search replaces stale part-number issues", async () => {
        await seedPartStudio(db);
        await db
            .update(insertables)
            .set({
                buildIssues: [
                    { type: BuildIssueType.NO_VENDORS },
                    { type: BuildIssueType.TOO_MANY_CONFIGURATIONS }
                ]
            })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p", partNumber: "PN-123" }
        ]);

        const res = await createTestApp().request(
            `/api/toggle-part-number-search/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { forceIndex: true }),
            env
        );
        expect(res.status).toBe(200);

        const row = await readInsertable(TEST_PART_STUDIO_ID);
        // The cap no longer applies, and the unrelated issue survives.
        expect(row?.buildIssues).toEqual([{ type: BuildIssueType.NO_VENDORS }]);
    });
});
