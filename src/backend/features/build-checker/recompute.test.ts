import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { configurations, group, insertables } from "../../db/schema";
import { BuildIssueType } from "./issues";
import { Vendor } from "../library/vendors";
import {
    TEST_GROUP_ID,
    TEST_PART_STUDIO_ID,
    resetDb,
    seedConfiguration,
    seedPartStudio
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { recomputeVisibilityChecks } from "./recompute";
import { configurationRecord } from "../../../__test_utils__/configuration-fixtures";

const db = getDb(env.DB);

function readInsertable() {
    return db
        .select()
        .from(insertables)
        .where(eq(insertables.id, TEST_PART_STUDIO_ID))
        .get();
}

function readGroup() {
    return db.select().from(group).where(eq(group.id, TEST_GROUP_ID)).get();
}

describe("recomputeVisibilityChecks", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
    });

    it("adds an unhidden part's quality issues back", async () => {
        // Hidden parts are exempt, so a newly visible one has none stored yet.
        await db.update(insertables).set({
            isVisible: true,
            vendors: [],
            smallThumbnailUrl: null,
            largeThumbnailUrl: null
        });

        await recomputeVisibilityChecks(db, [TEST_PART_STUDIO_ID]);

        expect((await readInsertable())?.buildIssues).toEqual([
            { type: BuildIssueType.THUMBNAIL_FAILED },
            { type: BuildIssueType.NO_VENDORS }
        ]);
    });

    it("re-derives the part-number issue from the stored records", async () => {
        // The records outlive a visibility toggle, so the check can run here
        // without asking Onshape anything.
        await seedConfiguration(db);
        await db.update(configurations).set({
            records: [configurationRecord({})]
        });
        await db
            .update(insertables)
            .set({ isVisible: true, vendors: [Vendor.REV] });

        await recomputeVisibilityChecks(db, [TEST_PART_STUDIO_ID]);

        expect((await readInsertable())?.buildIssues).toContainEqual({
            type: BuildIssueType.NO_PART_NUMBER
        });
    });

    it("drops a hidden part's quality issues", async () => {
        await db.update(insertables).set({
            isVisible: false,
            vendors: [],
            smallThumbnailUrl: null,
            largeThumbnailUrl: null,
            buildIssues: [{ type: BuildIssueType.NO_VENDORS }]
        });

        await recomputeVisibilityChecks(db, [TEST_PART_STUDIO_ID]);

        expect((await readInsertable())?.buildIssues).toEqual([]);
    });

    it("keeps issues these checks do not own", async () => {
        // A load failure is recorded elsewhere and must survive a recompute.
        await db.update(insertables).set({
            isVisible: false,
            vendors: [Vendor.REV],
            buildIssues: [
                { type: BuildIssueType.LOAD_FAILED },
                { type: BuildIssueType.NO_VENDORS }
            ]
        });

        await recomputeVisibilityChecks(db, [TEST_PART_STUDIO_ID]);

        expect((await readInsertable())?.buildIssues).toEqual([
            { type: BuildIssueType.LOAD_FAILED }
        ]);
    });

    it("flags the group once nothing in it is visible", async () => {
        await db.update(insertables).set({ isVisible: false });

        await recomputeVisibilityChecks(db, [TEST_PART_STUDIO_ID]);

        expect((await readGroup())?.buildIssues).toEqual([
            { type: BuildIssueType.NO_UNHIDDEN_INSERTABLES }
        ]);
    });

    it("clears the group's flag when a part becomes visible again", async () => {
        await db.update(group).set({
            buildIssues: [
                { type: BuildIssueType.NO_UNHIDDEN_INSERTABLES },
                { type: BuildIssueType.NO_THUMBNAIL_TAB }
            ]
        });
        await db.update(insertables).set({ isVisible: true });

        await recomputeVisibilityChecks(db, [TEST_PART_STUDIO_ID]);

        // The unrelated group issue stays put.
        expect((await readGroup())?.buildIssues).toEqual([
            { type: BuildIssueType.NO_THUMBNAIL_TAB }
        ]);
    });

    it("does nothing when given no insertables", async () => {
        await expect(
            recomputeVisibilityChecks(db, [])
        ).resolves.toBeUndefined();
    });
});
