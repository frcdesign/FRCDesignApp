import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { CachePolicy, cacheMiddleware, setCacheTtl } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getInsertableParam, insertableRoute } from "../../lib/route-params";
import { getInsertableElementPath } from "../library/insertables/routes";
import { getDb } from "../../db/client";
import { requireEditorMiddleware } from "../auth/guards";
import { bumpLibraryVersion } from "../library/db";

import { type InstancePath } from "../../lib/onshape/path";
import { group, insertables } from "../../db/schema";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import { ThumbnailSize } from "./types";
import {
    THUMBNAIL_FALLBACK_CACHE_TTL,
    THUMBNAIL_FALLBACK_HEADER,
    thumbnailKey
} from "./keys";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY,
    canonicalConfigurationKey
} from "../configurations/canonical";

import type { AppContext } from "../../lib/context";
import type { ThumbnailWorkflowParams } from "./workflow";
import { getSessionId } from "../auth/session";
import { BuildIssueType, clearBuildIssue } from "../build-checker/issues";
import { uploadDocumentThumbnails, uploadThumbnails } from "./store";

export const thumbnailRoutes = getApp();

const storedThumbnailParams = z.object({
    size: z.enum(ThumbnailSize),
    elementId: z.string().min(1)
});

/** Absent means the element default, which is what `""` encodes. */
const canonicalConfigurationQuery = z
    .string()
    .default(DEFAULT_CANONICAL_CONFIGURATION);

const storedThumbnailQuery = z.object({
    /** The microversion, part of the key — which is what makes a hit immutable. */
    v: z.string().min(1),
    c: canonicalConfigurationQuery,
    warm: z.stringbool().default(false),
    /** The insertable to render from; only sent with `warm`. */
    i: z.string().optional()
});

/**
 * GET /api/thumbnail/:size/:elementId?v=&c=&warm= — an unrendered configuration
 * falls back to the element default, and `warm` kicks off the real render.
 */
thumbnailRoutes.get(
    "/thumbnail/:size/:elementId",
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    zValidator("param", storedThumbnailParams),
    zValidator("query", storedThumbnailQuery),
    async (c) => {
        const { size, elementId } = c.req.valid("param");
        const {
            v: microversionId,
            c: canonicalConfiguration,
            warm,
            i: insertableId
        } = c.req.valid("query");
        const configurationKey = canonicalConfigurationKey(
            canonicalConfiguration
        );

        const object = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size, configurationKey)
        );
        if (object) {
            return thumbnailResponse(object);
        }

        if (configurationKey === DEFAULT_CONFIGURATION_KEY) {
            return c.notFound();
        }

        if (warm && insertableId) {
            await warmConfigurationThumbnail(c, {
                insertableId,
                microversionId,
                canonicalConfiguration
            });
        }

        // Stand in with the default configuration until the real render lands.
        const fallback = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size)
        );
        if (!fallback) {
            return c.notFound();
        }
        // Unlike a hit, this url does not pin these bytes.
        setCacheTtl(c, THUMBNAIL_FALLBACK_CACHE_TTL);
        const response = thumbnailResponse(fallback);
        response.headers.set(THUMBNAIL_FALLBACK_HEADER, "1");
        return response;
    }
);

function thumbnailResponse(object: R2ObjectBody): Response {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
}

/**
 * Concurrent requests can each start a run. Rare, and the workflow skips a
 * render that is already stored, which a reused id would rule out permanently.
 */
async function warmConfigurationThumbnail(
    c: AppContext,
    params: Omit<ThumbnailWorkflowParams, "sessionId">
): Promise<void> {
    try {
        // The render runs later, under this caller's Onshape tokens.
        await c.env.THUMBNAIL_WORKFLOW.create({
            params: { ...params, sessionId: getSessionId(c) }
        });
    } catch {
        // Never fatal: the caller still has the default thumbnail to serve.
    }
}

/** POST /api/reload-insertable-thumbnail/insertable/:insertableId */
thumbnailRoutes.post(
    "/reload-insertable-thumbnail" + insertableRoute(),
    requireEditorMiddleware,
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const insertableId = getInsertableParam(c);
        const db = getDb(c.env.DB);

        const elementPath = await getInsertableElementPath(db, insertableId);

        const row = await db
            .select({
                microversionId: insertables.microversionId,
                libraryId: insertables.libraryId,
                buildIssues: insertables.buildIssues
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();

        if (!row) {
            throw new HTTPException(HttpStatus.NOT_FOUND, {
                message: "Insertable not found"
            });
        }

        const thumbnails = await uploadThumbnails(
            c.env.BLOB,
            onshapeApi,
            elementPath,
            row.microversionId
        );

        await db
            .update(insertables)
            .set({
                smallThumbnailUrl: thumbnails.small,
                largeThumbnailUrl: thumbnails.large,
                buildIssues: clearBuildIssue(
                    row.buildIssues,
                    BuildIssueType.THUMBNAIL_FAILED
                )
            })
            .where(eq(insertables.id, insertableId));

        await bumpLibraryVersion(db, row.libraryId);
        return c.json({ success: true });
    }
);

/** POST /api/reload-group-thumbnail/group/:groupId */
thumbnailRoutes.post(
    "/reload-group-thumbnail/group/:groupId",
    requireEditorMiddleware,
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const groupId = c.req.param("groupId");
        const db = getDb(c.env.DB);

        const row = await db
            .select({
                documentId: group.documentId,
                versionId: group.versionId,
                libraryId: group.libraryId,
                buildIssues: group.buildIssues
            })
            .from(group)
            .where(eq(group.id, groupId))
            .get();

        if (!row) {
            throw new HTTPException(HttpStatus.NOT_FOUND, {
                message: "Group not found"
            });
        }

        const instancePath: InstancePath = {
            documentId: row.documentId,
            instanceId: row.versionId,
            instanceType: "v"
        };

        const thumbnails = await uploadDocumentThumbnails(
            c.env.BLOB,
            onshapeApi,
            instancePath
        );

        await db
            .update(group)
            .set({
                smallThumbnailUrl: thumbnails.small,
                largeThumbnailUrl: thumbnails.large,
                buildIssues: clearBuildIssue(
                    row.buildIssues,
                    BuildIssueType.THUMBNAIL_FAILED
                )
            })
            .where(eq(group.id, groupId));

        await bumpLibraryVersion(db, row.libraryId);
        return c.json({ success: true });
    }
);
