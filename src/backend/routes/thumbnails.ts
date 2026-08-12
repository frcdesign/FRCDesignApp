import { eq } from "drizzle-orm";
import {
    CachePolicy,
    cacheMiddleware,
    getApp,
    getInsertableParam,
    immutableCacheControl,
    insertableRoute
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
    THUMBNAIL_CACHE_TTL,
    THUMBNAIL_FALLBACK_CACHE_TTL,
    type ThumbnailParams,
    thumbnailConfigurationKey,
    thumbnailKey,
    thumbnailUrl,
    thumbnailWorkflowId
} from "../../shared/thumbnails";
import { DEFAULT_CONFIGURATION_KEY } from "../../shared/configuration-utils";
import { OnshapeApi } from "../onshape-api/onshape-api";
import type { AppBindings } from "../app";
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
            cacheControl: `public, max-age=${THUMBNAIL_CACHE_TTL}, immutable`
        },
        customMetadata: metadata
    });
}

/**
 * Renders and stores an element's default-configuration thumbnails, in both
 * sizes. Throws if Onshape hasn't rendered them yet, which is what drives the
 * load step's retries.
 */
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
            size: ThumbnailSize.SMALL
        }),
        large: thumbnailUrl({
            elementId,
            microversionId,
            size: ThumbnailSize.LARGE
        })
    };
}

/**
 * Renders and stores one configuration's thumbnails, in both sizes, so a row and
 * its hover never disagree. Uses the two-stage id flow, the only Onshape path
 * that takes a configuration; both calls can fail while Onshape renders, which
 * is what the caller's retries are for.
 */
export async function uploadConfigurationThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string,
    configuration: string
): Promise<void> {
    const thumbnailId = await getThumbnailId(
        onshapeApi,
        elementPath,
        configuration
    );
    const [small, large] = await Promise.all([
        getThumbnailFromId(onshapeApi, thumbnailId, ThumbnailSize.SMALL),
        getThumbnailFromId(onshapeApi, thumbnailId, ThumbnailSize.LARGE)
    ]);

    const configurationKey = thumbnailConfigurationKey(configuration);
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
                { microversionId, configuration }
            )
        )
    );
}

/**
 * Uploads document-level thumbnails using the document's designated thumbnail element.
 */
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

/**
 * GET /api/thumbnail/:size/:elementId?v=&c=&warm=
 *
 * Serves a stored thumbnail. `c` is the encoded canonical configuration (absent
 * for the default), `v` the microversion — both are part of the key, so a hit is
 * immutable. A configuration we haven't rendered falls back to the element's
 * default thumbnail, cached only briefly so the real one can take over as soon
 * as it lands; with `warm=1` the miss also kicks off that render.
 */
thumbnailRoutes.get("/thumbnail/:size/:elementId", async (c) => {
    const size = c.req.param("size") as ThumbnailSize;
    const elementId = c.req.param("elementId");
    const microversionId = c.req.query("v");
    if (!microversionId) {
        return c.json({ error: "v (microversionId) required" }, 400);
    }
    const configuration = c.req.query("c");
    const configurationKey = thumbnailConfigurationKey(configuration);

    const object = await c.env.THUMBNAILS.get(
        thumbnailKey(elementId, microversionId, size, configurationKey)
    );
    if (object) {
        return thumbnailResponse(object, THUMBNAIL_CACHE_TTL);
    }

    if (configurationKey === DEFAULT_CONFIGURATION_KEY) {
        return c.notFound();
    }

    if (c.req.query("warm") === "1" && configuration) {
        await warmConfigurationThumbnail(c.env, {
            elementId,
            microversionId,
            configuration
        });
    }

    // Stand in with the default configuration until the real render lands.
    const fallback = await c.env.THUMBNAILS.get(
        thumbnailKey(elementId, microversionId, size)
    );
    if (!fallback) {
        return c.notFound();
    }
    return thumbnailResponse(fallback, THUMBNAIL_FALLBACK_CACHE_TTL);
});

function thumbnailResponse(object: R2ObjectBody, maxAge: number): Response {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set(
        "Cache-Control",
        maxAge === THUMBNAIL_CACHE_TTL
            ? `public, max-age=${maxAge}, immutable`
            : `public, max-age=${maxAge}`
    );
    return new Response(object.body, { headers });
}

/**
 * Starts rendering a configuration's thumbnails, if nobody already is. The
 * configuration key doubles as the workflow instance id, so concurrent requests
 * for the same configuration collapse onto one run — a duplicate id is rejected,
 * which is exactly the outcome we want.
 */
async function warmConfigurationThumbnail(
    env: AppBindings,
    params: ThumbnailParams
): Promise<void> {
    try {
        await env.THUMBNAIL_WORKFLOW.create({
            id: thumbnailWorkflowId(params),
            params
        });
    } catch {
        // Already rendering (or the workflow couldn't start) — the caller still
        // has the default thumbnail to serve, so this is never fatal.
    }
}

/**
 * GET /api/thumbnail?size=X&thumbnailId=Y — live preview thumbnail from Onshape.
 *
 * With `elementId`, `v`, and `c`, the bytes are also stored under that
 * configuration's key on the way out: the insert menu keeps its responsive
 * two-stage flow and warms the cache for free, with no added latency.
 */
thumbnailRoutes.get("/thumbnail", requireSignInMiddleware, async (c) => {
    const onshapeApi = await c.var.getOnshapeApi();
    const size = (c.req.query("size") as ThumbnailSize) ?? ThumbnailSize.LARGE;
    const thumbnailId = c.req.query("thumbnailId");
    if (!thumbnailId) return c.json({ error: "thumbnailId required" }, 400);

    const buffer = await getThumbnailFromId(onshapeApi, thumbnailId, size);

    const elementId = c.req.query("elementId");
    const microversionId = c.req.query("v");
    const configuration = c.req.query("c");
    if (elementId && microversionId && configuration) {
        c.executionCtx.waitUntil(
            putThumbnail(
                c.env.THUMBNAILS,
                thumbnailKey(
                    elementId,
                    microversionId,
                    size,
                    thumbnailConfigurationKey(configuration)
                ),
                buffer,
                { microversionId, configuration }
            )
        );
    }

    return new Response(buffer, {
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": `public, max-age=${THUMBNAIL_CACHE_TTL}, immutable`
        }
    });
});

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
            c.env.THUMBNAILS,
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
            c.env.THUMBNAILS,
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
