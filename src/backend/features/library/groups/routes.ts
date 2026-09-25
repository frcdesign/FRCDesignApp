import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { cacheMiddleware } from "../../../lib/cache";
import { getApp } from "../../../lib/context";
import { getLibraryParam, libraryRoute } from "../../../lib/route-params";
import { getDb } from "../../../db/client";
import { chunkForInArray } from "../../../db/chunk";
import { getSessionId } from "../../auth/session";
import { getDocument } from "../../../lib/onshape/endpoints/documents";
import { requireEditorMiddleware } from "../../auth/guards";
import { type DocumentPath } from "../../../lib/onshape/path";
import {
    groups,
    insertables,
    favorites,
    WebhookSubject
} from "../../../db/schema";
import { bumpLibraryVersion, rebuildSearchDb } from "../db";
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../../lib/api-error";
import { getJobStatus, requestLoads } from "../../load/jobs";
import { createShellGroup } from "../../load/workflows";
import { removeWebhook } from "../../webhooks/registration";
import { deleteStaleThumbnails } from "../../thumbnails/reconcile";
import { parseThumbnailUrl } from "../../thumbnails/keys";
import { runInBackground } from "../../../lib/background";
import { z } from "zod";
import { validate } from "../../../lib/validate";

export const groupRoutes = getApp();

const setVisibilityBody = z.object({
    insertableIds: z.array(z.string()),
    isVisible: z.boolean()
});

const sortGroupBody = z.object({
    groupId: z.string().min(1),
    sortAlphabetically: z.boolean()
});

const groupOrderBody = z.object({ groupOrder: z.array(z.string()) });

const addGroupBody = z.object({
    newDocumentId: z.string().min(1),
    selectedGroupId: z.string().optional()
});

const deleteGroupQuery = z.object({ groupId: z.string().min(1) });

/** GET /api/job-status/library/:libraryId — checked on load, then pushed. */
groupRoutes.get(
    "/job-status" + libraryRoute(),
    requireEditorMiddleware,
    cacheMiddleware(),
    async (c) => {
        return c.json(await getJobStatus(c.env, getLibraryParam(c)));
    }
);

/** POST /api/set-insertable-visibility/library/:libraryId */
groupRoutes.post(
    "/set-insertable-visibility" + libraryRoute(),
    requireEditorMiddleware,
    validate("json", setVisibilityBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const body = c.req.valid("json");

        const db = getDb(c.env.DB);

        // "Hide all" can name more ids than one statement binds.
        const writes: BatchItem<"sqlite">[] = [];
        for (const insertableIds of chunkForInArray(body.insertableIds)) {
            if (!body.isVisible) {
                writes.push(
                    db
                        .delete(favorites)
                        .where(
                            and(
                                eq(favorites.libraryId, libraryId),
                                inArray(favorites.insertableId, insertableIds)
                            )
                        )
                );
            }
            writes.push(
                db
                    .update(insertables)
                    .set({ isVisible: body.isVisible })
                    .where(
                        and(
                            eq(insertables.libraryId, libraryId),
                            inArray(insertables.id, insertableIds)
                        )
                    )
            );
        }
        if (writes.length > 0) {
            await db.batch(
                writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
            );
        }

        // Before the bump, which makes /search-db immutable for a year.
        await rebuildSearchDb(c.env.BLOB, db, libraryId);
        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/sort-group-alphabetically/library/:libraryId */
groupRoutes.post(
    "/sort-group-alphabetically" + libraryRoute(),
    requireEditorMiddleware,
    validate("json", sortGroupBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const body = c.req.valid("json");

        const db = getDb(c.env.DB);
        await db
            .update(groups)
            .set({ sortAlphabetically: body.sortAlphabetically })
            .where(
                and(
                    eq(groups.id, body.groupId),
                    eq(groups.libraryId, libraryId)
                )
            );

        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/group-order/library/:libraryId */
groupRoutes.post(
    "/group-order" + libraryRoute(),
    requireEditorMiddleware,
    validate("json", groupOrderBody),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const body = c.req.valid("json");

        const db = getDb(c.env.DB);
        await Promise.all(
            body.groupOrder.map((id, i) =>
                db
                    .update(groups)
                    .set({ sortOrder: i })
                    .where(
                        and(eq(groups.id, id), eq(groups.libraryId, libraryId))
                    )
            )
        );

        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/group/library/:libraryId — add a new group from an Onshape document */
groupRoutes.post(
    "/group" + libraryRoute(),
    requireEditorMiddleware,
    validate("json", addGroupBody),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const libraryId = getLibraryParam(c);
        const body = c.req.valid("json");
        const sessionId = getSessionId(c);

        const documentPath: DocumentPath = { documentId: body.newDocumentId };

        let documentName: string;
        try {
            documentName = (await getDocument(onshapeApi, documentPath)).name;
        } catch {
            throw handledError(
                "Failed to find the specified document.",
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        const db = getDb(c.env.DB);

        const existingGroup = await db
            .select({ id: groups.id })
            .from(groups)
            .where(
                and(
                    eq(groups.documentId, body.newDocumentId),
                    eq(groups.libraryId, libraryId)
                )
            )
            .get();

        if (existingGroup) {
            throw handledError(
                "Document has already been added to library.",
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        const groupId = crypto.randomUUID();
        await createShellGroup(c.env, {
            groupId,
            documentId: body.newDocumentId,
            documentName,
            libraryId,
            selectedGroupId: body.selectedGroupId
        });
        await requestLoads(c.env, [
            {
                libraryId,
                groupId,
                sessionId,
                forceReload: false,
                origin: new URL(c.req.url).origin
            }
        ]);

        return c.json({ name: documentName });
    }
);

/** DELETE /api/group/library/:libraryId?groupId=X */
groupRoutes.delete(
    "/group" + libraryRoute(),
    requireEditorMiddleware,
    validate("query", deleteGroupQuery),
    async (c) => {
        const libraryId = getLibraryParam(c);
        const { groupId } = c.req.valid("query");

        const db = getDb(c.env.DB);

        // Read first: the cascade takes the rows naming them.
        const elements = await db
            .select({ elementId: insertables.elementId })
            .from(insertables)
            .where(eq(insertables.groupId, groupId));

        // Cascade deletes insertables → favorites, and configurations automatically
        const [deleted] = await db
            .delete(groups)
            .where(and(eq(groups.id, groupId), eq(groups.libraryId, libraryId)))
            .returning({
                documentId: groups.documentId,
                smallThumbnailUrl: groups.smallThumbnailUrl
            });

        if (deleted) {
            const thumbnailElement = deleted.smallThumbnailUrl
                ? parseThumbnailUrl(deleted.smallThumbnailUrl)?.elementId
                : undefined;
            await runInBackground(c, "delete the group's thumbnails", () =>
                deleteStaleThumbnails(c.env.BLOB, db, {
                    documentId: deleted.documentId,
                    elementIds: [
                        ...elements.map((row) => row.elementId),
                        ...(thumbnailElement ? [thumbnailElement] : [])
                    ]
                }).then(() => undefined)
            );

            // The document's webhook goes with the last group loaded from it.
            const stillUsed = await db
                .select({ id: groups.id })
                .from(groups)
                .where(eq(groups.documentId, deleted.documentId))
                .get();
            if (!stillUsed) {
                // Logged: a leftover webhook matches no group, so it reloads nothing.
                await removeWebhook(
                    c.env,
                    await c.var.getOnshapeApi(),
                    WebhookSubject.DOCUMENT,
                    deleted.documentId
                ).catch((error: unknown) => {
                    console.error(
                        `Failed to remove the webhook for ${deleted.documentId}`,
                        error
                    );
                });
            }
        }

        await rebuildSearchDb(c.env.BLOB, db, libraryId);
        await bumpLibraryVersion(db, libraryId);
        return c.json({ success: true });
    }
);
