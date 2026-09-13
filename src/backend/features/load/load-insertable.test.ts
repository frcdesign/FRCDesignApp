import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import type { PartMetadata } from "../configurations/contract";
import { configurationRecord } from "../../../__test_utils__/configuration-fixtures";
import {
    FAKE_STEP,
    MOCK_ONSHAPE_API,
    TEST_PARAMETERS,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import {
    insertableTarget,
    parsedInsertable
} from "../../../__test_utils__/insertable-fixtures";
import * as ConfigurationEndpoints from "../../lib/onshape/endpoints/configurations";
import * as PartsEndpoints from "../../lib/onshape/endpoints/parts";
import * as ThumbnailStore from "../thumbnails/store";
import { BuildIssueType } from "../build-checker/issues";
import { createLimiter, LOAD_CONCURRENCY, type LoadContext } from "./context";
import * as LoadContextModule from "./context";
import { loadInsertable, saveInsertable } from "./load-insertable";

const db = getDb(env.DB);

function readInsertable() {
    return db
        .select()
        .from(insertables)
        .where(eq(insertables.id, TEST_PART_STUDIO_ID))
        .get();
}

const partMetadata = (partNumber?: string): PartMetadata =>
    configurationRecord({ partNumber });

const record = (partNumber?: string, configurationKey = "") =>
    configurationRecord({ partNumber, configurationKey });

describe("saveInsertable", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
    });

    it("writes the computed columns and defaults the user-owned flags on insert", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({ isOpenComposite: true })
        );

        expect(await readInsertable()).toMatchObject({
            // User-owned flags start off.
            isVisible: false,
            supportsFasten: false,
            indexConfigurations: false,
            // Computed columns come from the parse.
            isOpenComposite: true,
            lastLoadedAt: expect.any(Date)
        });
    });

    it("overwrites the computed columns but preserves the user-owned flags on reload", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({ isOpenComposite: true })
        );
        // The user reveals the element, turns its features on, and reorders it.
        await db
            .update(insertables)
            .set({
                isVisible: true,
                supportsFasten: true,
                indexConfigurations: true,
                sortOrder: 5
            })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));

        // A reload finds it renamed and no longer a composite.
        await saveInsertable(
            db,
            insertableTarget({
                name: "Renamed",
                microversionId: "mv-2",
                sortOrder: 0
            }),
            parsedInsertable()
        );

        expect(await readInsertable()).toMatchObject({
            // Preserved.
            isVisible: true,
            supportsFasten: true,
            indexConfigurations: true,
            sortOrder: 5,
            // Overwritten.
            name: "Renamed",
            microversionId: "mv-2",
            isOpenComposite: false
        });
    });

    it("writes the computed configuration records", async () => {
        const records = [record("PN-1", "p=v1"), record("PN-2", "p=v2")];
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                configuration: { parameters: TEST_PARAMETERS, records }
            })
        );

        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.insertableId, TEST_PART_STUDIO_ID))
            .get();
        expect(config?.records).toEqual(records);
    });

    // The element's own part number is not a configuration of it, so probing an
    // unconfigurable element must not manufacture a configurations row.
    it("stores part data on the insertable without a configuration row", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                partMetadata: partMetadata("PN-default"),
                configuration: { parameters: [], records: [] }
            })
        );

        const insertable = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, TEST_PART_STUDIO_ID))
            .get();
        expect(insertable?.partMetadata).toEqual(partMetadata("PN-default"));
        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });

    // features/library/db.ts treats the row's existence as "configurable", so an
    // insertable that stops being configurable must lose the row, not blank it.
    it("drops the configuration row when there are no parameters", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                configuration: {
                    parameters: TEST_PARAMETERS,
                    records: [record("PN-1")]
                }
            })
        );
        await saveInsertable(db, insertableTarget(), parsedInsertable());

        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });
});

const ctx = (): LoadContext => ({
    env,
    sessionId: "test-session",
    step: FAKE_STEP,
    limit: createLimiter(LOAD_CONCURRENCY)
});

describe("loadInsertable", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
        vi.spyOn(
            LoadContextModule,
            "getOnshapeApiFromContext"
        ).mockResolvedValue(MOCK_ONSHAPE_API);
        vi.spyOn(ConfigurationEndpoints, "getConfiguration").mockResolvedValue({
            btType: "BTConfigurationResponse-2019",
            configurationParameters: []
        });
        // Non-empty, so the load has something to ask for a render of.
        vi.spyOn(PartsEndpoints, "getParts").mockResolvedValue([
            { partId: "p1" }
        ]);
    });

    afterEach(() => vi.restoreAllMocks());

    // A render can take half an hour to land. Holding a limiter slot while
    // waiting on one stalls every insertable queued behind it, which is most of
    // what a slow load spends its time on.
    // A thumbnail neither instance will give up is a build issue, not a
    // failed insertable: the row is still worth having without a picture.
    it("records a failed thumbnail rather than failing the insertable", async () => {
        vi.spyOn(ThumbnailStore, "uploadThumbnails").mockRejectedValue(
            new Error("no thumbnail anywhere")
        );

        await loadInsertable(
            ctx(),
            insertableTarget({
                insertableId: "ins-a",
                elementPath: { ...TEST_PART_STUDIO_PATH, elementId: "e-a" }
            })
        );

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-a"))
            .get();
        expect(row?.smallThumbnailUrl).toBeNull();
        expect(row?.buildIssues.map((issue) => issue.type)).toContain(
            BuildIssueType.THUMBNAIL_FAILED
        );
    });

    it("stores the urls both sizes landed at", async () => {
        vi.spyOn(ThumbnailStore, "uploadThumbnails").mockResolvedValue({
            small: "small.png",
            large: "large.png"
        });

        await loadInsertable(
            ctx(),
            insertableTarget({
                insertableId: "ins-b",
                elementPath: { ...TEST_PART_STUDIO_PATH, elementId: "e-b" }
            })
        );

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-b"))
            .get();
        expect(row?.smallThumbnailUrl).toBe("small.png");
        expect(row?.buildIssues.map((issue) => issue.type)).not.toContain(
            BuildIssueType.THUMBNAIL_FAILED
        );
    });
});
