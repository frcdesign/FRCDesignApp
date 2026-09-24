/**
 * Deletes stored thumbnails nothing points at. Nothing else expires them, so an
 * edited or removed element would leave its thumbnails behind for good.
 */
import { isNotNull, or } from "drizzle-orm";
import { type Db } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import {
    THUMBNAIL_PREFIX,
    parseThumbnailKey,
    parseThumbnailUrl,
    subjectKey,
    type ThumbnailSubject
} from "./keys";

/** R2 returns at most this many per call, and takes at most this many to delete. */
const R2_BATCH = 1000;

/** Bounds one run; a bigger bucket is finished by later runs. */
const MAX_PAGES = 50;

/**
 * Renders are stored before the row naming them is written, so anything newer
 * than a load could take is left alone.
 */
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

interface ReconcileResult {
    /** Objects under the thumbnail prefix this run looked at. */
    scanned: number;
    deleted: number;
    /** Keys left alone because nothing recognized them. */
    unrecognized: number;
    /** Kept because they are too new to tell apart from a render in flight. */
    tooRecent: number;
    /** True when the scan hit its page budget, so more may remain. */
    truncated: boolean;
    /** True when nothing was deleted because the live set could not be trusted. */
    skipped: boolean;
}

/** Across every library, since a thumbnail key names none. */
async function liveSubjects(db: Db): Promise<Set<string>> {
    const [insertableRows, groupRows] = await Promise.all([
        db
            .select({
                elementId: insertables.elementId,
                microversionId: insertables.microversionId
            })
            .from(insertables),
        // A group's thumbnail element is often not one of its insertables.
        db
            .select({
                smallThumbnailUrl: groups.smallThumbnailUrl,
                largeThumbnailUrl: groups.largeThumbnailUrl
            })
            .from(groups)
            .where(
                or(
                    isNotNull(groups.smallThumbnailUrl),
                    isNotNull(groups.largeThumbnailUrl)
                )
            )
    ]);

    const live = new Set(insertableRows.map(subjectKey));
    for (const row of groupRows) {
        for (const url of [row.smallThumbnailUrl, row.largeThumbnailUrl]) {
            const subject = url ? parseThumbnailUrl(url) : undefined;
            if (subject) {
                live.add(subjectKey(subject));
            }
        }
    }
    return live;
}

/** Whether a key's subject is one the library still shows. */
function isLive(live: Set<string>, subject: ThumbnailSubject): boolean {
    return live.has(subjectKey(subject));
}

/**
 * Idempotent. An empty live set deletes nothing: it could equally be a failed
 * read.
 */
export async function reconcileThumbnails(
    bucket: R2Bucket,
    db: Db,
    now: number = Date.now()
): Promise<ReconcileResult> {
    const live = await liveSubjects(db);
    const result: ReconcileResult = {
        scanned: 0,
        deleted: 0,
        unrecognized: 0,
        tooRecent: 0,
        truncated: false,
        skipped: live.size === 0
    };
    if (result.skipped) {
        return result;
    }

    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
        const listed = await bucket.list({
            prefix: THUMBNAIL_PREFIX,
            limit: R2_BATCH,
            cursor
        });
        result.scanned += listed.objects.length;

        const orphaned: string[] = [];
        for (const object of listed.objects) {
            const subject = parseThumbnailKey(object.key);
            if (!subject) {
                result.unrecognized += 1;
            } else if (isLive(live, subject)) {
                continue;
            } else if (now - object.uploaded.getTime() < MIN_AGE_MS) {
                result.tooRecent += 1;
            } else {
                orphaned.push(object.key);
            }
        }
        if (orphaned.length > 0) {
            await bucket.delete(orphaned);
            result.deleted += orphaned.length;
        }

        if (!listed.truncated) {
            return result;
        }
        cursor = listed.cursor;
    }

    result.truncated = true;
    return result;
}
