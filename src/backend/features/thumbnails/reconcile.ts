/**
 * Deletes a document's stored thumbnails nothing points at any more. Nothing
 * else expires them, so an edited or removed element would leave its
 * thumbnails behind for good.
 */
import { eq, inArray } from "drizzle-orm";
import { chunkForInArray } from "../../db/chunk";
import { type Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import {
    THUMBNAIL_PREFIX,
    parseThumbnailKey,
    parseThumbnailUrl,
    subjectKey
} from "./keys";

/** R2 returns at most this many per call, and takes at most this many to delete. */
const R2_BATCH = 1000;

/**
 * A load stores thumbnails before the rows naming them, and a load replacing
 * another can be storing them while the one it replaced cleans up.
 */
export const STALE_THUMBNAIL_GRACE_MS = 60 * 60 * 1000;

interface StaleThumbnailsScope {
    documentId: string;
    /** Every element of the document the thumbnails could belong to, past and present. */
    elementIds: string[];
}

/**
 * Across every library, since another library can load the same document.
 * Idempotent.
 */
export async function deleteStaleThumbnails(
    bucket: R2Bucket,
    db: Db,
    scope: StaleThumbnailsScope,
    graceMs = STALE_THUMBNAIL_GRACE_MS,
    now = Date.now()
): Promise<number> {
    const elementIds = [...new Set(scope.elementIds)];
    const live = await liveSubjects(db, scope.documentId, elementIds);

    let deleted = 0;
    for (const elementId of elementIds) {
        for (const kind of ["default", "config"]) {
            let cursor: string | undefined;
            do {
                const listed = await bucket.list({
                    prefix: `${THUMBNAIL_PREFIX}${kind}/${elementId}/`,
                    limit: R2_BATCH,
                    cursor
                });
                const stale = listed.objects
                    .filter((object) => {
                        const subject = parseThumbnailKey(object.key);
                        return (
                            subject &&
                            !live.has(subjectKey(subject)) &&
                            now - object.uploaded.getTime() >= graceMs
                        );
                    })
                    .map((object) => object.key);
                if (stale.length > 0) {
                    await bucket.delete(stale);
                    deleted += stale.length;
                }
                cursor = listed.truncated ? listed.cursor : undefined;
            } while (cursor);
        }
    }
    return deleted;
}

async function liveSubjects(
    db: Db,
    documentId: string,
    elementIds: string[]
): Promise<Set<string>> {
    const live = new Set<string>();
    for (const chunk of chunkForInArray(elementIds)) {
        const rows = await db
            .select({
                elementId: insertables.elementId,
                microversionId: insertables.microversionId
            })
            .from(insertables)
            .where(inArray(insertables.elementId, chunk));
        rows.forEach((row) => live.add(subjectKey(row)));
    }
    // A group's thumbnail element is often not one of its insertables.
    const groupRows = await db
        .select({
            smallThumbnailUrl: groups.smallThumbnailUrl,
            largeThumbnailUrl: groups.largeThumbnailUrl
        })
        .from(groups)
        .where(eq(groups.documentId, documentId));
    for (const row of groupRows) {
        for (const url of [row.smallThumbnailUrl, row.largeThumbnailUrl]) {
            const subject = url ? parseThumbnailUrl(url) : undefined;
            if (subject) live.add(subjectKey(subject));
        }
    }
    return live;
}
