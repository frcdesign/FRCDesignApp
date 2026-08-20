import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { configurations, insertables } from "../../shared/schema";
import type { ConfigurationRecord } from "../../shared/configuration-models";
import {
    TEST_PARAMETERS,
    TEST_PART_STUDIO_ID,
    resetDb,
    seedGroup
} from "../../__test_utils__";
import {
    insertableTarget,
    parsedInsertable
} from "../../__test_utils__/insertable-fixtures";
import { saveInsertable } from "./load-insertable";

const db = getDb(env.DB);

function readInsertable() {
    return db
        .select()
        .from(insertables)
        .where(eq(insertables.id, TEST_PART_STUDIO_ID))
        .get();
}

/** Builds a configuration record with the given part number and defaults. */
function record(
    partNumber: string | null,
    configuration: Record<string, string> = {}
): ConfigurationRecord {
    return {
        configuration,
        partNumber,
        name: null,
        description: null,
        material: null,
        vendor: null,
        hasMultipleParts: false,
        isUnstableComposite: false
    };
}

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
            lastLoadedAt: expect.any(Number)
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
        const records = [
            record("PN-1", { p: "v1" }),
            record("PN-2", { p: "v2" })
        ];
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
            .where(eq(configurations.id, TEST_PART_STUDIO_ID))
            .get();
        expect(config?.records).toEqual(records);
    });

    // An indexed insertable with no varying parameters still needs its records
    // stored, so a configurations row is kept even when `parameters` is empty.
    it("keeps a configuration row for a non-configurable indexed insertable", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                configuration: {
                    parameters: [],
                    records: [record("PN-default")]
                }
            })
        );

        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, TEST_PART_STUDIO_ID))
            .get();
        expect(config?.parameters).toEqual([]);
        expect(config?.records).toEqual([record("PN-default")]);
    });

    // library-data reads `records` off the row without re-checking whether the
    // insertable is still indexed, so a reload with neither parameters nor
    // records must drop the row rather than leave stale records behind.
    it("drops the configuration row when there are no parameters or records", async () => {
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
