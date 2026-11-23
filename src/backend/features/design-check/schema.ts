/** Kept out of `db/schema.ts`: a row names an Onshape document, not one of the app's rows. */

import {
    integer,
    primaryKey,
    sqliteTable,
    text
} from "drizzle-orm/sqlite-core";

/** An issue someone with edit access marked as meant, for everyone checking the document. */
export const designCheckDismissals = sqliteTable(
    "design_check_dismissals",
    {
        documentId: text("document_id").notNull(),
        elementId: text("element_id").notNull(),
        /** The issue's type and what it names (`getIssueKey`). */
        issueKey: text("issue_key").notNull(),
        dismissedBy: text("dismissed_by").notNull(),
        dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }).notNull()
    },
    (t) => [primaryKey({ columns: [t.documentId, t.elementId, t.issueKey] })]
);
