import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import type { ParameterValues, PartMetadata } from "../configurations/models";
import { configurationRecord } from "../../../__test_utils__/configuration-fixtures";
import {
    TEST_PARAMETERS,
    TEST_PART_STUDIO_ID,
    resetDb,
    seedGroup
} from "../../../__test_utils__";
import {
    insertableTarget,
    parsedInsertable
} from "../../../__test_utils__/insertable-fixtures";
import { saveInsertable } from "./load-insertable";

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

const record = (
    partNumber?: string,
    canonicalConfiguration: ParameterValues = {}
) => configurationRecord({ partNumber, canonicalConfiguration });

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
