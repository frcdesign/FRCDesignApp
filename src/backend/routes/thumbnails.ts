import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { CachePolicy, cacheMiddleware, immutableCacheControl, setCacheTtl } from "../cache";
import { getApp } from "../context";
import { getInsertableParam, insertableRoute } from "../route-params";
import { getInsertableElementPath } from "./insertables";
import { getDb } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import { bumpLibraryVersion } from "../library-data";
import {
    getElementThumbnail,
    getThumbnailFromId,
    getThumbnailId
} from "../onshape-api/endpoints/thumbnails";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import { type ElementPath, type InstancePath } from "../../shared/onshape-path";
import { group, insertables } from "../../shared/schema";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import { ThumbnailSize, ThumbnailUrls } from "../../shared/thumbnail-types";
import {
    THUMBNAIL_FALLBACK_CACHE_TTL,
    THUMBNAIL_FALLBACK_HEADER,
    thumbnailKey,
    thumbnailUrl
} from "../../shared/thumbnails";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY,
    canonicalConfigurationKey
} from "../../shared/canonical-configuration";
import { OnshapeApi } from "../onshape-api/onshape-api";
import type { AppContext } from "../context";
import type { ThumbnailWorkflowParams } from "../load/workflows";
import { getSessionId } from "../auth-session";
import { BuildIssueType, clearBuildIssue } from "../../shared/build-issues";

/** Stores one rendered thumbnail, tagging it with what produced it. */
async function putThumbnail(
    bucket: R2Bucket,
    key: string,
    thumbnail: ArrayBuffer,
    metadata: Record<string, string>
): Promise<void> {
    await bucket.put(key, thumbnail, {
        httpMetadata: {
            contentType: "image/gif",
            cacheControl: immutableCacheControl(CachePolicy.PUBLIC_CACHE)
        },
        customMetadata: metadata
    });
}

/** Throws until Onshape has rendered them, which drives the load step's retries. */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const [small, large] = await Promise.all([
        getElementThumbnail(onshapeApi, elementPath, ThumbnailSize.SMALL),
        getElementThumbnail(onshapeApi, elementPath, ThumbnailSize.LARGE)
    ]);
    if (!small || !large) {
        throw new Error("Failed to find thumbnails. Try again later.");
    }

    const { elementId } = elementPath;
    await Promise.all([
        putThumbnail(
            bucket,
            thumbnailKey(elementId, microversionId, ThumbnailSize.SMALL),
            small,
            { microversionId }
        ),
        putThumbnail(
            bucket,
            thumbnailKey(elementId, microversionId, ThumbnailSize.LARGE),
            large,
            { microversionId }
        )
    ]);

    return {
        small: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.SMALL,
            canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
        }),
        large: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.LARGE,
            canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
        })
    };
}

/** Whether every key is already stored, so the render can be skipped. */
async function allStored(bucket: R2Bucket, keys: string[]): Promise<boolean> {
    const heads = await Promise.all(keys.map((key) => bucket.head(key)));
    return heads.every((head) => head !== null);
}

/**
 * Both sizes, so a row and its hover never disagree. The two-stage id flow is the
 * only Onshape path taking a configuration; either call can fail mid-render.
 */
export async function uploadConfigurationThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string,
    canonicalConfiguration: string
): Promise<void> {
    const configurationKey = canonicalConfigurationKey(canonicalConfiguration);
    const { elementId } = elementPath;
    const targets = [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) => ({
        size,
        key: thumbnailKey(elementId, microversionId, size, configurationKey)
    }));
    const keys = targets.map((target) => target.key);

    // Runs are no longer deduplicated by id, and Onshape is the expensive part.
    if (await allStored(bucket, keys)) {
        return;
    }

    const thumbnailId = await getThumbnailId(
        onshapeApi,
        elementPath,
        canonicalConfiguration
    );
    const rendered = await Promise.all(
        targets.map(async ({ size, key }) => ({
            key,
            thumbnail: await getThumbnailFromId(onshapeApi, thumbnailId, size)
        }))
    );

    // The render above takes minutes, long enough to have been beaten to it.
    if (await allStored(bucket, keys)) {
        return;
    }

    await Promise.all(
        rendered.map(({ key, thumbnail }) =>
            putThumbnail(bucket, key, thumbnail, {
                microversionId,
                canonicalConfiguration
            })
        )
    );
}

/** Falls back to the first element when the document designates no thumbnail. */
export async function uploadDocumentThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    versionPath: InstancePath
): Promise<ThumbnailUrls> {
    const [onshapeDocument, contents] = await Promise.all([
        getDocument(onshapeApi, versionPath),
        getContents(onshapeApi, versionPath)
    ]);

    let thumbnailElementId = onshapeDocument.documentThumbnailElementId;
    if (!thumbnailElementId) {
        if (contents.elements.length < 1)
            throw new Error(
                `Document ${onshapeDocument.name} has no elements to use as a thumbnail.`
            );
        thumbnailElementId = contents.elements[0].id;
    }

    const element = contents.elements.find((e) => e.id === thumbnailElementId);
    if (!element) {
        throw new Error("Unexpectedly failed to find the thumbnail element.");
    }

    const thumbnailPath: ElementPath = {
        ...versionPath,
        elementId: thumbnailElementId
    };
    return uploadThumbnails(
        bucket,
        onshapeApi,
        thumbnailPath,
        element.microversionId
    );
}

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
