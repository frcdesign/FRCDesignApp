import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { configurations, insertables } from "../../shared/schema";
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

describe("saveInsertable", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
    });

    it("writes the computed columns and defaults the user-owned flags on insert", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                isOpenComposite: true,
                defaultPartNumber: "PN-1"
            })
        );

        expect(await readInsertable()).toMatchObject({
            // User-owned flags start off.
            isVisible: false,
            supportsFasten: false,
            searchPartNumbers: false,
            // Computed columns come from the parse.
            isOpenComposite: true,
            defaultPartNumber: "PN-1",
            lastLoadedAt: expect.any(Number)
        });
    });

    it("overwrites the computed columns but preserves the user-owned flags on reload", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                isOpenComposite: true,
                defaultPartNumber: "PN-1"
            })
        );
        // The user reveals the element, turns its features on, and reorders it.
        await db
            .update(insertables)
            .set({
                isVisible: true,
                supportsFasten: true,
                searchPartNumbers: true,
                sortOrder: 5
            })
            .where(eq(insertables.id, TEST_PART_STUDIO_ID));

        // A reload finds it renamed, no longer a composite, with no part number.
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
            searchPartNumbers: true,
            sortOrder: 5,
            // Overwritten.
            name: "Renamed",
            microversionId: "mv-2",
            isOpenComposite: false,
            defaultPartNumber: null
        });
    });

    it("inserts the configuration row when there are parameters and drops it when there aren't", async () => {
        await saveInsertable(
            db,
            insertableTarget(),
            parsedInsertable({
                configuration: {
                    parameters: TEST_PARAMETERS,
                    partNumbers: { "PN-1": { boolean: "true" } }
                }
            })
        );
        const config = await db
            .select()
            .from(configurations)
            .where(eq(configurations.id, TEST_PART_STUDIO_ID))
            .get();
        expect(config).toMatchObject({
            parameters: TEST_PARAMETERS,
            partNumbers: { "PN-1": { boolean: "true" } }
        });

        // getPartNumberMap in library-data.ts reads the config without
        // re-checking searchPartNumbers, so a reload with no parameters must
        // drop the row rather than leave stale part numbers behind.
        await saveInsertable(db, insertableTarget(), parsedInsertable());
        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });
});
