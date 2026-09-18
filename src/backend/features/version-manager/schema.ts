/**
 * The version manager's own table, kept out of `db/schema.ts` because nothing
 * here points at the app's data: a link names Onshape ids, not library rows.
 */

import {
    sqliteTable,
    text,
    integer,
    index,
    unique
} from "drizzle-orm/sqlite-core";

/**
 * One directed edge: the target workspace references content from the source.
 * Push runs along it, pull runs against it — so the source is what the contract
 * calls the parent, and the target its child.
 *
 * Stored once rather than as a row per end. The implementation this came from
 * kept both, which meant a link could half-exist when only one of the two
 * writes landed.
 *
 * Not owned by a user: a link belongs to the workspaces, so everyone who opens
 * the document works from the same graph.
 */
export const workspaceLinks = sqliteTable(
    "workspace_links",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        sourceDocumentId: text("source_document_id").notNull(),
        sourceWorkspaceId: text("source_workspace_id").notNull(),
        targetDocumentId: text("target_document_id").notNull(),
        targetWorkspaceId: text("target_workspace_id").notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
    },
    (t) => [
        unique().on(
            t.sourceDocumentId,
            t.sourceWorkspaceId,
            t.targetDocumentId,
            t.targetWorkspaceId
        ),
        // One index per end: a workspace's links are read in both directions,
        // and a push walks the graph a workspace at a time.
        index("workspace_links_source_idx").on(
            t.sourceDocumentId,
            t.sourceWorkspaceId
        ),
        index("workspace_links_target_idx").on(
            t.targetDocumentId,
            t.targetWorkspaceId
        )
    ]
);

/** One stored edge. */
export type WorkspaceLinkRow = typeof workspaceLinks.$inferSelect;
