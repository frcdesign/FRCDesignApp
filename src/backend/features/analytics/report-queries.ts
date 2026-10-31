import { and, desc, eq, gte, inArray, lte, ne, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { insertables } from "../../db/schema";
import { toElementPath } from "../../lib/onshape/path";
import { type LibraryId } from "../library/library-id";
import { libraryTopic, type FeedbackTopic } from "../feedback/contract";
import { type ReportedPartOut, type ReportSummary } from "./contract";
import { type DayRange } from "./day";
import { dailyReportMetrics } from "./schema";

/** Enough to name what needs fixing first; the rest are in Discord. */
const REPORTED_PART_LIMIT = 10;

function inRange(range: DayRange) {
    return and(
        gte(dailyReportMetrics.day, range.from),
        lte(dailyReportMetrics.day, range.to)
    );
}

/** Every topic's reports, or one topic's. */
export async function getReportSummary(
    db: Db,
    range: DayRange,
    topic?: FeedbackTopic
): Promise<ReportSummary> {
    const rows = await db
        .select({
            topic: dailyReportMetrics.topic,
            category: dailyReportMetrics.category,
            source: dailyReportMetrics.source,
            count: sum(dailyReportMetrics.count)
        })
        .from(dailyReportMetrics)
        .where(
            and(
                inRange(range),
                topic ? eq(dailyReportMetrics.topic, topic) : undefined
            )
        )
        .groupBy(
            dailyReportMetrics.topic,
            dailyReportMetrics.category,
            dailyReportMetrics.source
        )
        .all();
    return {
        counts: rows.map((row) => ({ ...row, count: Number(row.count ?? 0) }))
    };
}

/** Only parts still in the library, which is all a reader can act on. */
export async function getReportedParts(
    db: Db,
    libraryId: LibraryId,
    range: DayRange
): Promise<ReportedPartOut[]> {
    const counted = sum(dailyReportMetrics.count);
    const rows = await db
        .select({ elementId: dailyReportMetrics.elementId, count: counted })
        .from(dailyReportMetrics)
        .where(
            and(
                inRange(range),
                eq(dailyReportMetrics.topic, libraryTopic(libraryId)),
                ne(dailyReportMetrics.elementId, "")
            )
        )
        .groupBy(dailyReportMetrics.elementId)
        .orderBy(desc(counted))
        .limit(REPORTED_PART_LIMIT)
        .all();
    if (rows.length === 0) return [];

    const parts = await db
        .select({
            elementId: insertables.elementId,
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            name: insertables.name
        })
        .from(insertables)
        .where(
            and(
                eq(insertables.libraryId, libraryId),
                inArray(
                    insertables.elementId,
                    rows.map((row) => row.elementId)
                )
            )
        )
        .all();
    const byElement = new Map(parts.map((part) => [part.elementId, part]));

    return rows.flatMap((row) => {
        const part = byElement.get(row.elementId);
        if (!part) return [];
        return [
            {
                path: toElementPath(part),
                name: part.name,
                count: Number(row.count ?? 0)
            }
        ];
    });
}
