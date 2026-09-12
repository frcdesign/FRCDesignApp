import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import {
    resetDb,
    seedGroup,
    TEST_GROUP_ID,
    TEST_LIBRARY_ID
} from "../../../__test_utils__";
import {
    insertableTarget,
    parsedInsertable
} from "../../../__test_utils__/insertable-fixtures";
import { saveInsertable } from "../load/load-insertable";
import { BuildIssueType } from "../build-checker/issues";
import { recordThumbnailOutcome } from "./record";

const db = getDb(env.DB);

const URLS = { small: "/small.gif", large: "/large.gif" };

/** What a load leaves behind: no urls, and the render still outstanding. */
const PENDING = [{ type: BuildIssueType.THUMBNAIL_PENDING }];

describe("recordThumbnailOutcome", () => {
    let insertableId = "";

    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
        const target = insertableTarget();
        insertableId = target.insertableId;
        await saveInsertable(db, target, parsedInsertable());
        await db
            .update(insertables)
            .set({
                smallThumbnailUrl: null,
                largeThumbnailUrl: null,
                buildIssues: PENDING
            })
            .where(eq(insertables.id, insertableId));
    });

    const readInsertable = () =>
        db
            .select()
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();

    const owner = () =>
        ({
            kind: "insertable",
            libraryId: TEST_LIBRARY_ID,
            insertableId
        }) as const;

    it("writes the urls and clears the pending issue", async () => {
        expect(
            await recordThumbnailOutcome(db, owner(), {
                stored: true,
                urls: URLS
            })
        ).toBe(true);

        const row = await readInsertable();
        expect(row?.smallThumbnailUrl).toBe(URLS.small);
        expect(row?.largeThumbnailUrl).toBe(URLS.large);
        expect(row?.buildIssues).toEqual([]);
    });

    // The row said "still rendering" only because a load queued it; once the
    // renderer gives up that stops being true.
    it("replaces pending with failed when nothing landed", async () => {
        await recordThumbnailOutcome(db, owner(), { stored: false });

        const row = await readInsertable();
        expect(row?.buildIssues).toEqual([
            { type: BuildIssueType.THUMBNAIL_FAILED }
        ]);
        expect(row?.smallThumbnailUrl).toBeNull();
    });

    // Issues the load recorded for other reasons are not this function's to
    // throw away.
    it("leaves unrelated issues alone", async () => {
        await db
            .update(insertables)
            .set({
                buildIssues: [...PENDING, { type: BuildIssueType.NO_VENDORS }]
            })
            .where(eq(insertables.id, insertableId));

        await recordThumbnailOutcome(db, owner(), {
            stored: true,
            urls: URLS
        });

        expect((await readInsertable())?.buildIssues).toEqual([
            { type: BuildIssueType.NO_VENDORS }
        ]);
    });

    it("records a group's thumbnail the same way", async () => {
        await recordThumbnailOutcome(
            db,
            {
                kind: "group",
                libraryId: TEST_LIBRARY_ID,
                groupId: TEST_GROUP_ID
            },
            { stored: true, urls: URLS }
        );

        const row = await db
            .select()
            .from(groups)
            .where(eq(groups.id, TEST_GROUP_ID))
            .get();
        expect(row?.smallThumbnailUrl).toBe(URLS.small);
    });

    // A render outlives the row when a reload deletes the insertable partway
    // through; there is nothing to record and nothing wrong.
    it("reports nothing written when the row is gone", async () => {
        await db.delete(insertables).where(eq(insertables.id, insertableId));

        expect(
            await recordThumbnailOutcome(db, owner(), { stored: false })
        ).toBe(false);
    });
});
