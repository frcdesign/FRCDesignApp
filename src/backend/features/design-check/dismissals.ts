/** Issues someone marked as meant, kept per document so everyone checking it sees the same. */
import { and, eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { type DesignDismissIn, getIssueKey, type TabCheck } from "./contract";
import { designCheckDismissals } from "./schema";

/** Marks each issue the document has a dismissal for. */
export async function markDismissed(
    db: Db,
    documentId: string,
    tabs: TabCheck[]
): Promise<TabCheck[]> {
    const rows = await db
        .select({
            elementId: designCheckDismissals.elementId,
            issueKey: designCheckDismissals.issueKey
        })
        .from(designCheckDismissals)
        .where(eq(designCheckDismissals.documentId, documentId));
    const dismissed = new Set(
        rows.map((row) => `${row.elementId}|${row.issueKey}`)
    );
    return tabs.map((tab) => ({
        ...tab,
        issues: tab.issues.map((issue) =>
            dismissed.has(`${tab.elementId}|${getIssueKey(issue)}`)
                ? { ...issue, dismissed: true }
                : issue
        )
    }));
}

export async function setDismissed(
    db: Db,
    userId: string,
    request: DesignDismissIn
): Promise<void> {
    const { documentId, elementId, issueKey } = request;
    if (!request.dismissed) {
        await db
            .delete(designCheckDismissals)
            .where(
                and(
                    eq(designCheckDismissals.documentId, documentId),
                    eq(designCheckDismissals.elementId, elementId),
                    eq(designCheckDismissals.issueKey, issueKey)
                )
            );
        return;
    }
    await db
        .insert(designCheckDismissals)
        .values({
            documentId,
            elementId,
            issueKey,
            dismissedBy: userId,
            dismissedAt: new Date()
        })
        .onConflictDoNothing();
}
