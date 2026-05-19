import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { type AppBindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getAccessLevel } from "../onshape-api/endpoints/users";
import {
    getElementThumbnail,
    getThumbnailId,
    ThumbnailSize
} from "../onshape-api/endpoints/thumbnails";
import { getDocument, getContents } from "../onshape-api/endpoints/documents";
import {
    isElementPath,
    type ElementPath,
    type InstancePath
} from "../../shared/path";
import { documents, elements } from "../../shared/schema";
import { HTTPException } from "hono/http-exception";

const THUMBNAIL_CACHE_TTL = 30 * 24 * 3600;

function r2Key(size: string, elementId: string): string {
    return `thumbnails/${size}/${elementId}`;
}

/**
 * Uploads thumbnails for an element to R2.
 * Returns a thumbnailUrls map: { size: "/api/thumbnail/{size}/{elementId}?v={microversionId}" }
 */
export async function uploadThumbnails(
    bucket: R2Bucket,
    onshapeApi: Awaited<ReturnType<typeof getOnshapeApi>>,
    elementPath: ElementPath,
    microversionId: string,
    sizes: ThumbnailSize[] = [ThumbnailSize.TINY, ThumbnailSize.STANDARD]
): Promise<Partial<Record<ThumbnailSize, string>>> {
    const urls: Partial<Record<ThumbnailSize, string>> = {};

    await Promise.all(
        sizes.map(async (size) => {
            let thumbnail: ArrayBuffer;
            try {
                thumbnail = await getElementThumbnail(
                    onshapeApi,
                    elementPath,
                    size
                );
            } catch {
                return;
            }

            const key = r2Key(size, elementPath.elementId);
            await bucket.put(key, thumbnail, {
                httpMetadata: {
                    contentType: "image/gif",
                    cacheControl: `public, max-age=${THUMBNAIL_CACHE_TTL}, immutable`
                },
                customMetadata: { microversionId }
            });

            urls[size] =
                `/api/thumbnail/${size}/${elementPath.elementId}?v=${microversionId}`;
        })
    );

    return urls;
}

/**
 * Uploads document-level thumbnails using the document's designated thumbnail element.
 */
export async function uploadDocumentThumbnails(
    bucket: R2Bucket,
    onshapeApi: Awaited<ReturnType<typeof getOnshapeApi>>,
    onshapeDocument: any,
    contents: any,
    versionPath: InstancePath
): Promise<Partial<Record<ThumbnailSize, string>>> {
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
    if (!element)
        throw new Error("Unexpectedly failed to find the thumbnail element.");

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

// ─── Access helpers ────────────────────────────────────────────────────────────

async function requireEditorAccess(c: {
    env: AppBindings;
}): Promise<Awaited<ReturnType<typeof getOnshapeApi>>> {
    const onshapeApi = await getOnshapeApi(c as any);
    const adminTeam = (c.env as any).ADMIN_TEAM;
    if (!adminTeam) throw new Error("ADMIN_TEAM must be configured");
    const level = await getAccessLevel(onshapeApi, adminTeam);
    if (level !== "editor" && level !== "admin")
        throw new Error("Insufficient permissions");
    return onshapeApi;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const thumbnailRoutes = new Hono<{ Bindings: AppBindings }>();

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
    const onshapeApi = await getOnshapeApi(c);
    const size =
        (c.req.query("size") as ThumbnailSize) ?? ThumbnailSize.STANDARD;
    const thumbnailId = c.req.query("thumbnailId");
    if (!thumbnailId) return c.json({ error: "thumbnailId required" }, 400);

    const { getThumbnailFromId } =
        await import("../onshape-api/endpoints/thumbnails");
    const buffer = await getThumbnailFromId(onshapeApi, thumbnailId, size);
    return new Response(buffer, {
        headers: { "Content-Type": "image/gif" }
    });
});

/** GET /api/thumbnail-id/d/:docId/:instanceType/:instanceId/e/:elementId */
thumbnailRoutes.get(
    "/thumbnail-id/d/:docId/:instanceType/:instanceId/e/:elementId",
    async (c) => {
        const onshapeApi = await getOnshapeApi(c);
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

/** POST /api/reload-thumbnail/:library/d/:docId/:instanceType/:instanceId — reload document thumbnail */
thumbnailRoutes.post(
    "/reload-thumbnail/:library/d/:docId/:instanceType/:instanceId",
    async (c) => {
        const onshapeApi = await requireEditorAccess(c);
        const instancePath: InstancePath = {
            documentId: c.req.param("docId"),
            instanceId: c.req.param("instanceId"),
            instanceType: c.req.param("instanceType") as "w" | "v" | "m"
        };

        const [onshapeDoc, contents] = await Promise.all([
            getDocument(onshapeApi, instancePath),
            getContents(onshapeApi, instancePath)
        ]);

        const thumbnails = await uploadDocumentThumbnails(
            c.env.THUMBNAILS,
            onshapeApi,
            onshapeDoc,
            contents,
            instancePath
        );

        if (Object.keys(thumbnails).length < 2) {
            return c.json(
                {
                    type: "handled",
                    message:
                        "Failed to upload thumbnail. Does it exist in Onshape?",
                    isError: true
                },
                422
            );
        }

        const db = getDb(c.env.DB);
        await db
            .update(documents)
            .set({ thumbnailUrls: JSON.stringify(thumbnails) })
            .where(eq(documents.id, instancePath.documentId));

        return c.json({ success: true });
    }
);

/** POST /api/reload-thumbnail/:library/d/:docId/:instanceType/:instanceId/e/:elementId — reload element thumbnail */
thumbnailRoutes.post(
    "/reload-thumbnail/:library/d/:docId/:instanceType/:instanceId/e/:elementId",
    async (c) => {
        const onshapeApi = await requireEditorAccess(c);
        const elementPath: ElementPath = {
            documentId: c.req.param("docId"),
            instanceId: c.req.param("instanceId"),
            instanceType: c.req.param("instanceType") as "w" | "v" | "m",
            elementId: c.req.param("elementId")
        };

        if (!isElementPath(elementPath)) {
            throw new HTTPException(400, {
                message: "Invalid elementPath received"
            });
        }

        const db = getDb(c.env.DB);
        const element = await db
            .select()
            .from(elements)
            .where(eq(elements.id, elementPath.elementId))
            .get();

        if (!element) {
            throw new HTTPException(404, {
                message: "Failed to find element"
            });
        }

        const thumbnails = await uploadThumbnails(
            c.env.THUMBNAILS,
            onshapeApi,
            elementPath,
            element.microversionId
        );

        if (Object.keys(thumbnails).length < 2) {
            return c.json(
                {
                    type: "handled",
                    message:
                        "Failed to upload thumbnail. Does it exist in Onshape?",
                    isError: true
                },
                422
            );
        }

        await db
            .update(elements)
            .set({ thumbnailUrls: JSON.stringify(thumbnails) })
            .where(eq(elements.id, elementPath.elementId));

        return c.json({ success: true });
    }
);
