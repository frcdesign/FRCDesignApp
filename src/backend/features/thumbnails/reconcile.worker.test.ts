import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, type Db } from "../../db/client";
import {
    resetDb,
    seedGroup,
    seedInsertable,
    seedPartStudio
} from "../../../__test_utils__/seed";
import { ThumbnailSize } from "./contract";
import { thumbnailKey, thumbnailUrl } from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";
import { deleteStaleThumbnails } from "./reconcile";
import { LibraryId } from "../library/library-id";

const ELEMENT = "element-1";
const LIVE_MICROVERSION = "mv-live";
const OLD_MICROVERSION = "mv-old";
const DOCUMENT = "doc-g1";

/** Past the grace period, so what these tests store counts as settled. */
const LATER = Date.now() + 2 * 60 * 60 * 1000;

let db: Db;

async function store(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => env.BLOB.put(key, "x")));
}

async function storedKeys(): Promise<string[]> {
    const listed = await env.BLOB.list({ prefix: "thumbnails/" });
    return listed.objects.map((object) => object.key).sort();
}

function defaultKeys(elementId: string, microversionId: string): string[] {
    return Object.values(ThumbnailSize).map((size) =>
        thumbnailKey(elementId, microversionId, size)
    );
}

const clean = (elementIds: string[], now = LATER) =>
    deleteStaleThumbnails(
        env.BLOB,
        db,
        { documentId: DOCUMENT, elementIds },
        undefined,
        now
    );

beforeEach(async () => {
    db = getDb(env.DB);
    await resetDb(db);
    const listed = await env.BLOB.list();
    await Promise.all(listed.objects.map((o) => env.BLOB.delete(o.key)));
});

describe("deleteStaleThumbnails", () => {
    it("deletes an element's old microversion, renders included", async () => {
        await seedPartStudio(db, {
            elementId: ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        const render = (microversionId: string) =>
            thumbnailKey(
                ELEMENT,
                microversionId,
                ThumbnailSize.LARGE,
                "size=l"
            );
        await store(
            ...defaultKeys(ELEMENT, LIVE_MICROVERSION),
            ...defaultKeys(ELEMENT, OLD_MICROVERSION),
            render(LIVE_MICROVERSION),
            render(OLD_MICROVERSION)
        );

        expect(await clean([ELEMENT])).toBe(3);
        expect(await storedKeys()).toEqual(
            [
                ...defaultKeys(ELEMENT, LIVE_MICROVERSION),
                render(LIVE_MICROVERSION)
            ].sort()
        );
    });

    it("deletes everything of an element nothing names any more", async () => {
        await store(...defaultKeys("element-removed", OLD_MICROVERSION));
        expect(await clean(["element-removed"])).toBe(2);
        expect(await storedKeys()).toEqual([]);
    });

    it("leaves elements outside the document alone", async () => {
        await store(...defaultKeys("elsewhere", OLD_MICROVERSION));
        expect(await clean([ELEMENT])).toBe(0);
        expect(await storedKeys()).toHaveLength(2);
    });

    // The row's urls are the only record of which element it is.
    it("keeps the document thumbnail a group's urls point at", async () => {
        const subject = {
            elementId: "thumbnail-tab",
            microversionId: "mv-doc"
        };
        const url = (size: ThumbnailSize) =>
            thumbnailUrl({
                ...subject,
                size,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            });
        await seedGroup(db, "g1", undefined, {
            smallThumbnailUrl: url(ThumbnailSize.SMALL),
            largeThumbnailUrl: url(ThumbnailSize.LARGE)
        });
        await store(...defaultKeys(subject.elementId, subject.microversionId));

        expect(await clean([subject.elementId])).toBe(0);
    });

    // Another library can load the same document.
    it("keeps what another library's insertable still names", async () => {
        await seedGroup(db, "g-ftc", LibraryId.FTC_DESIGN_LIB);
        await seedInsertable(db, {
            id: "ftc-insertable",
            groupId: "g-ftc",
            libraryId: LibraryId.FTC_DESIGN_LIB,
            elementId: ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await store(...defaultKeys(ELEMENT, LIVE_MICROVERSION));

        expect(await clean([ELEMENT])).toBe(0);
    });

    it("keeps what was stored too recently to be settled", async () => {
        await store(...defaultKeys(ELEMENT, OLD_MICROVERSION));
        expect(await clean([ELEMENT], Date.now())).toBe(0);
        expect(await storedKeys()).toHaveLength(2);
    });
});
