import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
    CachePolicy,
    cacheMiddleware,
    getApp,
    getInsertableParam,
    immutableCacheControl,
    insertableRoute,
    setCacheTtl
} from "../app";
import { getInsertableElementPath } from "./insertables";
import { getDb } from "../db";
import { requireEditorMiddleware } from "../access-level-utils";
import { requireSignInMiddleware } from "../sign-in-utils";
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
import { ThumbnailSize, ThumbnailUrls } from "../../shared/types";
import {
    THUMBNAIL_FALLBACK_CACHE_TTL,
    type ThumbnailParams,
    thumbnailKey,
    thumbnailUrl,
    thumbnailWorkflowId
} from "../../shared/thumbnails";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    DEFAULT_CONFIGURATION_KEY,
    canonicalConfigurationKey
} from "../../shared/canonical-configuration";
import { OnshapeApi } from "../onshape-api/onshape-api";
import type { AppContext } from "../app";
import { getSessionId } from "../auth";
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
    const thumbnailId = await getThumbnailId(
        onshapeApi,
        elementPath,
        canonicalConfiguration
    );
    const [small, large] = await Promise.all([
        getThumbnailFromId(onshapeApi, thumbnailId, ThumbnailSize.SMALL),
        getThumbnailFromId(onshapeApi, thumbnailId, ThumbnailSize.LARGE)
    ]);

    const configurationKey = canonicalConfigurationKey(canonicalConfiguration);
    const { elementId } = elementPath;
    await Promise.all(
        (
            [
                [ThumbnailSize.SMALL, small],
                [ThumbnailSize.LARGE, large]
            ] as const
        ).map(([size, thumbnail]) =>
            putThumbnail(
                bucket,
                thumbnailKey(elementId, microversionId, size, configurationKey),
                thumbnail,
                { microversionId, canonicalConfiguration }
            )
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
    warm: z.stringbool().default(false)
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
            warm
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

        if (warm) {
            await warmConfigurationThumbnail(c, {
                elementId,
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
        return thumbnailResponse(fallback);
    }
);

function thumbnailResponse(object: R2ObjectBody): Response {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
}

/** Concurrent requests collapse onto one run: Cloudflare rejects a duplicate id. */
async function warmConfigurationThumbnail(
    c: AppContext,
    params: ThumbnailParams
): Promise<void> {
    try {
        // The render runs later, under this caller's Onshape tokens.
        await c.env.THUMBNAIL_WORKFLOW.create({
            id: thumbnailWorkflowId(params),
            params: { ...params, sessionId: getSessionId(c) }
        });
    } catch {
        // Never fatal: the caller still has the default thumbnail to serve.
    }
}

const liveThumbnailQuery = z.object({
    thumbnailId: z.string().min(1),
    size: z.enum(ThumbnailSize).default(ThumbnailSize.LARGE),
    /** With `v` and `c`, the bytes are stored under that configuration's key. */
    elementId: z.string().optional(),
    v: z.string().optional(),
    c: canonicalConfigurationQuery
});

/**
 * GET /api/thumbnail?size=X&thumbnailId=Y — live from Onshape. With `elementId`,
 * `v`, and `c` it also stores the bytes, warming the cache at no added latency.
 */
thumbnailRoutes.get(
    "/thumbnail",
    requireSignInMiddleware,
    // The thumbnailId names immutable content, so there is no `?v=` to bust.
    cacheMiddleware(CachePolicy.PUBLIC_CACHE, { versioned: false }),
    zValidator("query", liveThumbnailQuery),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const {
            thumbnailId,
            size,
            elementId,
            v: microversionId,
            c: canonicalConfiguration
        } = c.req.valid("query");

        const buffer = await getThumbnailFromId(onshapeApi, thumbnailId, size);

        if (
            elementId &&
            microversionId &&
            canonicalConfiguration !== DEFAULT_CANONICAL_CONFIGURATION
        ) {
            c.executionCtx.waitUntil(
                putThumbnail(
                    c.env.BLOB,
                    thumbnailKey(
                        elementId,
                        microversionId,
                        size,
                        canonicalConfigurationKey(canonicalConfiguration)
                    ),
                    buffer,
                    { microversionId, canonicalConfiguration }
                )
            );
        }

        return new Response(buffer, {
            headers: { "Content-Type": "image/gif" }
        });
    }
);

/** GET /api/thumbnail-id/d/:docId/:instanceType/:instanceId/e/:elementId */
thumbnailRoutes.get(
    "/thumbnail-id/d/:docId/:instanceType/:instanceId/e/:elementId",
    requireSignInMiddleware,
    // Its url names an immutable version, so there is no `?v=` to bust.
    cacheMiddleware(CachePolicy.PUBLIC_CACHE, { versioned: false }),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const elementPath: ElementPath = {
            documentId: c.req.param("docId"),
            instanceId: c.req.param("instanceId"),
            instanceType: c.req.param("instanceType") as "w" | "v" | "m",
            elementId: c.req.param("elementId")
        };
        const configuration = c.req.query("configuration");
        const thumbnailId = await getThumbnailId(
            onshapeApi,
            elementPath,
            configuration
        );
        return c.json({ thumbnailId });
    }
);

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
