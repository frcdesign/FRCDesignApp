import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { insertables } from "../../db/schema";
import {
    MOCK_ONSHAPE_API,
    resetDb,
    seedGroup,
    TEST_GROUP_ID
} from "../../../__test_utils__";
import {
    insertableTarget,
    parsedInsertable
} from "../../../__test_utils__/insertable-fixtures";
import { saveInsertable } from "../load/load-insertable";
import { BuildIssueType } from "../build-checker/issues";
import * as DocumentEndpoints from "../../lib/onshape/endpoints/documents";
import {
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";
import * as ThumbnailEndpoints from "../../lib/onshape/endpoints/thumbnails";
import { OnshapeApiError } from "../../lib/onshape/client";
import { ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { reloadGroupThumbnail, reloadInsertableThumbnail } from "./reload";

const db = getDb(env.DB);
const WORKSPACE_ID = "w-1";

/** Onshape's answer per instance type, so the fallback is observable. */
function mockThumbnails(
    answer: (instanceType: string) => Promise<ArrayBuffer>
) {
    return vi
        .spyOn(ThumbnailEndpoints, "getElementThumbnail")
        .mockImplementation((_client, path) => answer(path.instanceType));
}

const rendered = () => Promise.resolve(new ArrayBuffer(4));
const missing = () =>
    Promise.reject(new OnshapeApiError("Onshape API error 404: nope", 404));

describe("reloading a thumbnail", () => {
    let target = insertableTarget();

    beforeEach(async () => {
        await resetDb(db);
        await seedGroup(db);
        target = insertableTarget();
        await saveInsertable(db, target, parsedInsertable());
        // A row a load left without a picture, which is what a reload is for.
        await db
            .update(insertables)
            .set({
                smallThumbnailUrl: null,
                largeThumbnailUrl: null,
                buildIssues: [{ type: BuildIssueType.THUMBNAIL_FAILED }]
            })
            .where(eq(insertables.id, target.insertableId));

        vi.spyOn(DocumentEndpoints, "getDocument").mockResolvedValue({
            id: "doc",
            name: "Doc",
            defaultWorkspace: { id: WORKSPACE_ID }
        });
    });

    afterEach(() => vi.restoreAllMocks());

    const readRow = () =>
        db
            .select()
            .from(insertables)
            .where(eq(insertables.id, target.insertableId))
            .get();

    it("records the urls and clears the failure", async () => {
        mockThumbnails(rendered);

        await reloadInsertableThumbnail(
            db,
            env.BLOB,
            MOCK_ONSHAPE_API,
            target.insertableId
        );

        const row = await readRow();
        expect(row?.smallThumbnailUrl).toContain(target.elementPath.elementId);
        expect(row?.buildIssues).toEqual([]);
    });

    // The same fallback a load uses: the version is asked first, and the
    // workspace is what actually answers.
    it("falls back to the workspace", async () => {
        const calls = mockThumbnails((instanceType) =>
            instanceType === "v" ? missing() : rendered()
        );

        await reloadInsertableThumbnail(
            db,
            env.BLOB,
            MOCK_ONSHAPE_API,
            target.insertableId
        );

        expect(
            calls.mock.calls.some((call) => call[1].instanceType === "w")
        ).toBe(true);
        expect((await readRow())?.buildIssues).toEqual([]);
    });

    // `uploadThumbnails` skips a size the bucket already holds, which would
    // make asking again do nothing at all.
    it("replaces what is already stored", async () => {
        const key = thumbnailKey(
            target.elementPath.elementId,
            target.microversionId,
            ThumbnailSize.SMALL
        );
        await env.BLOB.put(key, "stale-bytes");
        mockThumbnails(rendered);

        await reloadInsertableThumbnail(
            db,
            env.BLOB,
            MOCK_ONSHAPE_API,
            target.insertableId
        );

        expect(await (await env.BLOB.get(key))?.text()).not.toBe("stale-bytes");
    });

    it("leaves the row alone when neither instance has one", async () => {
        mockThumbnails(missing);

        await expect(
            reloadInsertableThumbnail(
                db,
                env.BLOB,
                MOCK_ONSHAPE_API,
                target.insertableId
            )
        ).rejects.toThrow();

        expect((await readRow())?.buildIssues).toEqual([
            { type: BuildIssueType.THUMBNAIL_FAILED }
        ]);
    });

    it("says so when the element is not in the library", async () => {
        await expect(
            reloadInsertableThumbnail(
                db,
                env.BLOB,
                MOCK_ONSHAPE_API,
                "not-an-insertable"
            )
        ).rejects.toThrow();
    });

    it("reloads a group's own thumbnail from its document", async () => {
        vi.spyOn(DocumentEndpoints, "getContents").mockResolvedValue({
            elements: [
                {
                    id: "cover",
                    name: "Cover",
                    elementType: OnshapeElementType.PART_STUDIO,
                    microversionId: "mv-cover"
                }
            ],
            folders: {
                btType: OnshapeFolderEntryType.GROUP,
                groups: []
            }
        });
        mockThumbnails(rendered);

        await reloadGroupThumbnail(
            db,
            env.BLOB,
            MOCK_ONSHAPE_API,
            TEST_GROUP_ID
        );

        const key = thumbnailKey("cover", "mv-cover", ThumbnailSize.SMALL);
        expect(await env.BLOB.head(key)).not.toBeNull();
    });
});
