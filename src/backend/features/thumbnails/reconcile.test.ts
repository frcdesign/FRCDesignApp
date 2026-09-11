import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, type Db } from "../../db/client";
import {
    resetDb,
    seedGroup,
    seedInsertable,
    seedPartStudio
} from "../../../__test_utils__/seed";
import { ThumbnailSize } from "./types";
import { thumbnailKey, thumbnailUrl } from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/models";
import { reconcileThumbnails } from "./reconcile";
import { LibraryId } from "../library/library-id";

const LIVE_ELEMENT = "element-1";
const LIVE_MICROVERSION = "mv-live";
const OLD_MICROVERSION = "mv-old";

/** A day and a half on, so what these tests store is past the grace period. */
const LATER = Date.now() + 36 * 60 * 60 * 1000;

let db: Db;

/** Writes a byte at each key, which is all reconciliation reads. */
async function store(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => env.BLOB.put(key, "x")));
}

async function storedKeys(): Promise<string[]> {
    const listed = await env.BLOB.list({ prefix: "thumbnails/" });
    return listed.objects.map((object) => object.key).sort();
}

/** Both sizes for one subject, as the store always writes them in a pair. */
function defaultKeys(elementId: string, microversionId: string): string[] {
    return Object.values(ThumbnailSize).map((size) =>
        thumbnailKey(elementId, microversionId, size)
    );
}

beforeEach(async () => {
    db = getDb(env.DB);
    await resetDb(db);
    const listed = await env.BLOB.list();
    await Promise.all(listed.objects.map((o) => env.BLOB.delete(o.key)));
});

describe("reconcileThumbnails", () => {
    it("keeps what an insertable still names and deletes the rest", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await store(
            ...defaultKeys(LIVE_ELEMENT, LIVE_MICROVERSION),
            ...defaultKeys(LIVE_ELEMENT, OLD_MICROVERSION),
            ...defaultKeys("element-gone", LIVE_MICROVERSION)
        );

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.deleted).toBe(4);
        expect(await storedKeys()).toEqual(
            defaultKeys(LIVE_ELEMENT, LIVE_MICROVERSION).sort()
        );
    });

    // A configuration render is addressed by the same element and microversion,
    // so it has to follow the element rather than outlive it.
    it("deletes a configuration render whose microversion moved on", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        const liveConfig = thumbnailKey(
            LIVE_ELEMENT,
            LIVE_MICROVERSION,
            ThumbnailSize.LARGE,
            "size=l"
        );
        const staleConfig = thumbnailKey(
            LIVE_ELEMENT,
            OLD_MICROVERSION,
            ThumbnailSize.LARGE,
            "size=l"
        );
        await store(liveConfig, staleConfig);

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.deleted).toBe(1);
        expect(await storedKeys()).toEqual([liveConfig]);
    });

    // A group's document thumbnail is usually not one of its own insertables,
    // and the urls on the row are the only record of which element it is.
    it("keeps the document thumbnail a group's urls still point at", async () => {
        const subject = {
            elementId: "doc-thumbnail-element",
            microversionId: "mv-doc"
        };
        await seedGroup(db, "g1", undefined, {
            smallThumbnailUrl: thumbnailUrl({
                ...subject,
                size: ThumbnailSize.SMALL,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            }),
            largeThumbnailUrl: thumbnailUrl({
                ...subject,
                size: ThumbnailSize.LARGE,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            })
        });
        await seedInsertable(db, {
            groupId: "g1",
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        const keys = defaultKeys(subject.elementId, subject.microversionId);
        await store(...keys);

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.deleted).toBe(0);
        expect(await storedKeys()).toEqual(keys.sort());
    });

    it("leaves a key it does not recognize alone", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await store("thumbnails/something-else", "thumbnails/config/only-two");

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.unrecognized).toBe(2);
        expect(result.deleted).toBe(0);
        expect(await storedKeys()).toHaveLength(2);
    });

    it("touches nothing outside the thumbnail prefix", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await env.BLOB.put("search-index/frcDesignLib.json", "{}");

        await reconcileThumbnails(env.BLOB, db, LATER);

        expect(await env.BLOB.get("search-index/frcDesignLib.json")).not.toBe(
            null
        );
    });

    // An empty read and an empty library look identical, and only one of them
    // is worth emptying the bucket over.
    it("deletes nothing when the live set is empty", async () => {
        await store(...defaultKeys(LIVE_ELEMENT, LIVE_MICROVERSION));

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.skipped).toBe(true);
        expect(result.deleted).toBe(0);
        expect(await storedKeys()).toHaveLength(2);
    });

    it("is idempotent, so a retried step re-deletes nothing", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await store(...defaultKeys(LIVE_ELEMENT, OLD_MICROVERSION));

        expect((await reconcileThumbnails(env.BLOB, db, LATER)).deleted).toBe(2);
        const second = await reconcileThumbnails(env.BLOB, db, LATER);
        expect(second.deleted).toBe(0);
        expect(second.scanned).toBe(0);
    });

    // A group load stores thumbnails as it goes and writes its rows at the
    // end, and a configuration render is started by a user rather than a job —
    // so something in flight is indistinguishable from something orphaned.
    it("keeps an orphan too new to tell apart from a render in flight", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await store(...defaultKeys("element-being-added", "mv-new"));

        // Reconciled now, so what was just stored is inside the grace period.
        const result = await reconcileThumbnails(env.BLOB, db);

        expect(result.tooRecent).toBe(2);
        expect(result.deleted).toBe(0);
        expect(await storedKeys()).toHaveLength(2);
    });

    it("collects that same orphan once it is old enough", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await store(...defaultKeys("element-being-added", "mv-new"));

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.tooRecent).toBe(0);
        expect(result.deleted).toBe(2);
    });

    // The key names no library, so a set built from one library would read
    // every other library's thumbnails as orphaned.
    it("keeps a thumbnail belonging to another library", async () => {
        await seedPartStudio(db, {
            elementId: LIVE_ELEMENT,
            microversionId: LIVE_MICROVERSION
        });
        await seedGroup(db, "g-ftc", LibraryId.FTC_DESIGN_LIB);
        await seedInsertable(db, {
            id: "other-library-insertable",
            groupId: "g-ftc",
            libraryId: LibraryId.FTC_DESIGN_LIB,
            elementId: "element-ftc",
            microversionId: "mv-ftc"
        });
        const keys = defaultKeys("element-ftc", "mv-ftc");
        await store(...keys, ...defaultKeys(LIVE_ELEMENT, LIVE_MICROVERSION));

        const result = await reconcileThumbnails(env.BLOB, db, LATER);

        expect(result.deleted).toBe(0);
        expect(await storedKeys()).toHaveLength(4);
    });
});
