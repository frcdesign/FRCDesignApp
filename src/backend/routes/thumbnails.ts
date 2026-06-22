import { eq } from "drizzle-orm";
import { getApp, getInsertableParam, insertableRoute } from "../app";
import { getInsertableElementPath } from "./insertables";
import { getDb } from "../db";
import { requireAdminMiddleware } from "../access-level-utils";
import { bumpLibraryVersion } from "../library-data";
import {
    getElementThumbnail,
    getThumbnailFromId,
    getThumbnailId,
    ThumbnailSize
} from "../onshape-api/endpoints/thumbnails";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import { type ElementPath, type InstancePath } from "../../shared/onshape-path";
import { groups, insertables } from "../../shared/schema";
import { HTTPException } from "hono/http-exception";
import { ThumbnailUrls } from "../../shared/types";
import { OnshapeApi } from "../onshape-api/onshape-api";
import { BuildIssueType, clearBuildIssue } from "../../shared/build-checker";

const THUMBNAIL_CACHE_TTL = 30 * 24 * 3600;

function r2Key(size: string, elementId: string): string {
    return `thumbnails/${size}/${elementId}`;
}

export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: OnshapeApi,
    elementPath: ElementPath,
    microversionId: string
): Promise<ThumbnailUrls> {
    const fetchThumbnail = async (
        size: ThumbnailSize
    ): Promise<ArrayBuffer | null> => {
        try {
            return getElementThumbnail(onshapeApi, elementPath, size);
        } catch {
            return null;
        }
    };

    // Fetch in parallel
    const [tinyThumbnail, standardThumbnail] = await Promise.all([
        fetchThumbnail(ThumbnailSize.TINY),
        fetchThumbnail(ThumbnailSize.STANDARD)
    ]);

    if (!tinyThumbnail || !standardThumbnail) {
        throw new Error("Failed to find thumbnails. Try again later.");
    }

    const uploadThumbnail = async (
        size: ThumbnailSize,
        thumbnail: ArrayBuffer
    ) => {
        await bucket.put(r2Key(size, elementPath.elementId), thumbnail, {
            httpMetadata: {
                contentType: "image/gif",
                cacheControl: `public, max-age=${THUMBNAIL_CACHE_TTL}, immutable`
            },
            customMetadata: { microversionId }
        });
        return `/api/thumbnail/${size}/${elementPath.elementId}?v=${microversionId}`;
    };

    const [tinyUrl, standardUrl] = await Promise.all([
        uploadThumbnail(ThumbnailSize.TINY, tinyThumbnail),
        uploadThumbnail(ThumbnailSize.STANDARD, standardThumbnail)
    ]);

    return {
        [ThumbnailSize.TINY]: tinyUrl,
        [ThumbnailSize.STANDARD]: standardUrl
    };
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

    let thumbnailElementId: string = onshapeDocument.documentThumbnailElementId;
    if (!thumbnailElementId) {
        const els: any[] = contents.elements;
        if (els.length < 1)
            throw new Error(
                `Document ${onshapeDocument.name} has no elements to use as a thumbnail.`
            );
        thumbnailElementId = els[0].id;
    }

    const element = (contents.elements as any[]).find(
        (e) => e.id === thumbnailElementId
    );
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

/** GET /api/thumbnail/:size/:elementId — serve static thumbnail from R2 */
thumbnailRoutes.get("/thumbnail/:size/:elementId", async (c) => {
    const size = c.req.param("size");
    const elementId = c.req.param("elementId");

    const obj = await c.env.THUMBNAILS.get(r2Key(size, elementId));
    if (!obj) return c.notFound();

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set(
        "Cache-Control",
        `public, max-age=${THUMBNAIL_CACHE_TTL}, immutable`
    );

    return new Response(obj.body, { headers });
});

/** GET /api/thumbnail?size=X&thumbnailId=Y — live preview thumbnail from Onshape */
thumbnailRoutes.get("/thumbnail", async (c) => {
    const onshapeApi = await c.var.getOnshapeApi();
    const size =
        (c.req.query("size") as ThumbnailSize) ?? ThumbnailSize.STANDARD;
    const thumbnailId = c.req.query("thumbnailId");
    if (!thumbnailId) return c.json({ error: "thumbnailId required" }, 400);

    const buffer = await getThumbnailFromId(onshapeApi, thumbnailId, size);
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
    requireAdminMiddleware,
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
            throw new HTTPException(404, { message: "Insertable not found" });
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
                thumbnailUrls: thumbnails,
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
    requireAdminMiddleware,
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const groupId = c.req.param("groupId");
        const db = getDb(c.env.DB);

        const row = await db
            .select({
                documentId: groups.documentId,
                instanceId: groups.instanceId,
                libraryId: groups.libraryId,
                buildIssues: groups.buildIssues
            })
            .from(groups)
            .where(eq(groups.id, groupId))
            .get();

        if (!row) {
            throw new HTTPException(404, { message: "Group not found" });
        }

        const instancePath: InstancePath = {
            documentId: row.documentId,
            instanceId: row.instanceId,
            instanceType: "v"
        };

        const thumbnails = await uploadDocumentThumbnails(
            c.env.THUMBNAILS,
            onshapeApi,
            instancePath
        );

        await db
            .update(groups)
            .set({
                thumbnailUrls: thumbnails,
                buildIssues: clearBuildIssue(
                    row.buildIssues,
                    BuildIssueType.THUMBNAIL_FAILED
                )
            })
            .where(eq(groups.id, groupId));

        await bumpLibraryVersion(db, row.libraryId);
        return c.json({ success: true });
    }
);
