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
import { type ReloadedFields, saveInsertable } from "./load-insertable";
import type { InsertableGroupFields, InsertableElement } from "./load-utils";

const db = getDb(env.DB);

const groupFields: InsertableGroupFields = {
    libraryId: TEST_LIBRARY_ID,
    groupId: TEST_GROUP_ID,
    documentId: `doc-${TEST_GROUP_ID}`,
    versionId: "inst-2"
};

function element(
    overrides: Partial<InsertableElement> = {}
): InsertableElement {
    return {
        insertableId: "ins-1",
        elementId: "elem-1",
        name: "Element",
        elementType: ElementType.PART_STUDIO,
        microversionId: "mv-1",
        sortOrder: 0,
        supportsFasten: false,
        ...overrides
    };
}

/** Applies the save the way loadInsertable's save step does. */
async function applySave(
    el: InsertableElement,
    parameters: ParameterObj[]
): Promise<void> {
    const reloaded: ReloadedFields = {
        name: el.name,
        elementType: el.elementType,
        microversionId: el.microversionId,
        versionId: groupFields.versionId,
        vendors: [],
        thumbnailUrls: null,
        fastenInfo: null,
        buildIssues: []
    };
    await saveInsertable(db, groupFields, el, reloaded, parameters);
}

describe("saveInsertable", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
    });

    it("creates the row and its configuration, and a replay converges", async () => {
        await applySave(element(), TEST_PARAMETERS);
        await applySave(element(), TEST_PARAMETERS);

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
        await applySave(element(), []);
        // The user hides the element and moves it before the next reload.
        await db
            .update(insertables)
            .set({ isVisible: false, sortOrder: 5 })
            .where(eq(insertables.id, "ins-1"));

        await applySave(
            element({
                name: "Renamed",
                microversionId: "mv-2",
                sortOrder: 0
            }),
            []
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
        await applySave(element(), TEST_PARAMETERS);
        await applySave(element(), []);

        expect(await db.select().from(configurations).all()).toHaveLength(0);
    });
});
