import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { insertables } from "../../db/schema";
import {
    MOCK_ONSHAPE_API,
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
import { LibraryId } from "../library/library-id";
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
const MAIN_WORKSPACE = "w-main";

function mockThumbnails(answer: () => Promise<ArrayBuffer>) {
    return vi
        .spyOn(ThumbnailEndpoints, "getElementThumbnail")
        .mockImplementation(answer);
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
            defaultWorkspace: { id: MAIN_WORKSPACE }
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
            TEST_LIBRARY_ID,
            target.insertableId
        );

        const row = await readRow();
        expect(row?.smallThumbnailUrl).toContain(target.elementPath.elementId);
        expect(row?.buildIssues).toEqual([]);
    });

    it("reads from the version, and the document's workspace when that fails", async () => {
        const calls = vi
            .spyOn(ThumbnailEndpoints, "getElementThumbnail")
            .mockImplementation((_api, path) =>
                path.instanceType === "v" ? missing() : rendered()
            );

        await reloadInsertableThumbnail(
            db,
            env.BLOB,
            MOCK_ONSHAPE_API,
            TEST_LIBRARY_ID,
            target.insertableId
        );

        expect(calls.mock.calls.map((call) => call[1].instanceId)).toEqual([
            target.elementPath.instanceId,
            MAIN_WORKSPACE,
            target.elementPath.instanceId,
            MAIN_WORKSPACE
        ]);
        expect((await readRow())?.buildIssues).toEqual([]);
    });

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
            TEST_LIBRARY_ID,
            target.insertableId
        );

        expect(await (await env.BLOB.get(key))?.text()).not.toBe("stale-bytes");
    });

    it("leaves the row alone while Onshape has not rendered one", async () => {
        mockThumbnails(missing);

        await expect(
            reloadInsertableThumbnail(
                db,
                env.BLOB,
                MOCK_ONSHAPE_API,
                TEST_LIBRARY_ID,
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
                TEST_LIBRARY_ID,
                "not-an-insertable"
            )
        ).rejects.toThrow();
    });

    // An editor's access is to the named library alone.
    it("refuses an element of another library", async () => {
        await expect(
            reloadInsertableThumbnail(
                db,
                env.BLOB,
                MOCK_ONSHAPE_API,
                LibraryId.CONFIG_LIB,
                target.insertableId
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
            TEST_LIBRARY_ID,
            TEST_GROUP_ID
        );

        const key = thumbnailKey("cover", "mv-cover", ThumbnailSize.SMALL);
        expect(await env.BLOB.head(key)).not.toBeNull();
    });
});
