/**
 * Deletes stored thumbnails nothing in the library still points at. Renders are
 * kept indefinitely by design — the element default is what every unrendered
 * configuration falls back to — so nothing expires them, and an element edited
 * or removed would otherwise leave its thumbnails behind for good.
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

/**
 * A bucket large enough to need more than this is reconciled over several runs.
 * Bounds one step's work rather than the total, which repeated reloads reach.
 */
const MAX_PAGES = 50;

/**
 * How long a thumbnail is left alone regardless of the live set. A render is
 * stored before the row naming it is written — a group load uploads as it goes
 * and commits its rows at the end, and a configuration render is started by a
 * user opening the insert menu, outside any job this could wait on. Either one
 * would look orphaned while it is in flight. Matched to the job TTL, since that
 * is the longest a load is expected to take; anything genuinely orphaned is
 * simply collected by a later reload instead.
 */
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

export interface ReconcileResult {
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

/**
 * Every element and microversion the library still shows. Spans every library:
 * a thumbnail key names no library, so a set built from one would read every
 * other library's thumbnails as orphaned.
 */
export async function liveSubjects(db: Db): Promise<Set<string>> {
    const [insertableRows, groupRows] = await Promise.all([
        db
            .select({
                elementId: insertables.elementId,
                microversionId: insertables.microversionId
            })
            .from(insertables),
        // A group's document thumbnail is recorded only as the urls serving it,
        // and its element is often not one of the group's own insertables.
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
 * Idempotent, so a retried workflow step only re-deletes what is already gone.
 * Deletes nothing when the live set is empty: a library really can have no
 * elements, but so can a read that failed, and only one of those is worth
 * emptying the bucket over.
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
