import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { configurations, insertables } from "../../shared/schema";
import type { ParameterObj } from "../../shared/configuration-models";
import { ElementType } from "../../shared/types";
import {
    TEST_GROUP_ID,
    TEST_LIBRARY_ID,
    TEST_PARAMETERS,
    resetDb,
    seedGroup
} from "../../__test_utils__";
import {
    type InheritedProps,
    type InsertableJob,
    buildReloadedFields,
    buildSaveBatch
} from "./load-insertable";

const db = getDb(env.DB);

const inherited: InheritedProps = {
    libraryId: TEST_LIBRARY_ID,
    groupId: TEST_GROUP_ID,
    documentId: `doc-${TEST_GROUP_ID}`,
    versionId: "inst-2"
};

function job(overrides: Partial<InsertableJob> = {}): InsertableJob {
    return {
        insertableId: "ins-1",
        elementId: "elem-1",
        name: "Element",
        elementType: ElementType.PART_STUDIO,
        microversionId: "mv-1",
        sortOrder: 0,
        isNew: true,
        supportsFasten: false,
        ...overrides
    };
}

/** Builds and applies the save batch the way loadInsertable's save step does. */
async function applySave(
    insertableJob: InsertableJob,
    parameters: ParameterObj[] | null
): Promise<void> {
    const reloaded = buildReloadedFields(
        inherited,
        insertableJob,
        { parameters, vendors: [], fastenInfo: null },
        null
    );
    await db.batch(
        buildSaveBatch(db, inherited, insertableJob, reloaded, parameters)
    );
}

describe("buildSaveBatch", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
    });

    it("creates the row and its configuration, and a replay converges", async () => {
        await applySave(job(), TEST_PARAMETERS);
        await applySave(job(), TEST_PARAMETERS);

        const rows = await db.select().from(insertables).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: "ins-1",
            groupId: TEST_GROUP_ID,
            elementId: "elem-1",
            microversionId: "mv-1",
            versionId: "inst-2"
        });

        const configs = await db.select().from(configurations).all();
        expect(configs).toHaveLength(1);
        expect(configs[0]).toMatchObject({
            id: "ins-1",
            parameters: TEST_PARAMETERS
        });
    });

    it("preserves user-owned fields when reloading an existing row", async () => {
        await applySave(job(), null);
        // The user hides the element and moves it before the next reload.
        await db
            .update(insertables)
            .set({ isVisible: false, sortOrder: 5 })
            .where(eq(insertables.id, "ins-1"));

        await applySave(
            job({
                isNew: false,
                name: "Renamed",
                microversionId: "mv-2",
                sortOrder: 0
            }),
            null
        );

        const row = await db
            .select()
            .from(insertables)
            .where(eq(insertables.id, "ins-1"))
            .get();
        expect(row).toMatchObject({
            name: "Renamed",
            microversionId: "mv-2",
            isVisible: false,
            sortOrder: 5
        });
    });

    it("drops the configuration row when the element no longer has one", async () => {
        await applySave(job(), TEST_PARAMETERS);
        await applySave(job({ isNew: false }), null);

        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });

    it("emits only the insertable write for a new element without a configuration", () => {
        const newJob = job();
        const reloaded = buildReloadedFields(
            inherited,
            newJob,
            { parameters: null, vendors: [], fastenInfo: null },
            null
        );
        expect(
            buildSaveBatch(db, inherited, newJob, reloaded, null)
        ).toHaveLength(1);
    });
});
