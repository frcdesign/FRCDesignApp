import { z } from "zod";
import { HttpStatus } from "http-status-ts";
import { handledError } from "../../lib/api-error";
import { validate } from "../../lib/validate";
import { CachePolicy, setCache } from "../../lib/cache";
import { getApp } from "../../lib/context";

import { ThumbnailSize } from "./contract";
import { isSignedIn } from "../auth/request-auth";
import { thumbnailKey } from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";
import { requestRender } from "./render";
import { requireEditor } from "../auth/guards";
import { libraryOfGroup, libraryOfInsertable } from "../library/db";
import { getDb } from "../../db/client";
import { reloadGroupThumbnail, reloadInsertableThumbnail } from "./reload";

export const thumbnailRoutes = getApp();

const storedThumbnailParams = z.object({
    size: z.enum(ThumbnailSize),
    elementId: z.string().min(1)
});

/** Absent means the element default, which is what `""` encodes. */
const configurationKeyQuery = z.string().default(DEFAULT_CONFIGURATION_KEY);

const storedThumbnailQuery = z.object({
    /** The microversion, part of the key — which is what makes a hit immutable. */
    v: z.string().min(1),
    configurationKey: configurationKeyQuery,
    /** The insertable to render a miss from; absent serves what is stored. */
    insertableId: z.string().optional()
});

/** GET /api/thumbnail/:size/:elementId?v=&configurationKey=&insertableId= */
thumbnailRoutes.get(
    "/thumbnail/:size/:elementId",
    validate("param", storedThumbnailParams),
    validate("query", storedThumbnailQuery),
    async (c) => {
        const { size, elementId } = c.req.valid("param");
        const {
            v: microversionId,
            configurationKey,
            insertableId
        } = c.req.valid("query");
        const object = await c.env.BLOB.get(
            thumbnailKey(elementId, microversionId, size, configurationKey)
        );
        if (object) {
            // The url pins microversion and configuration.
            return setCache(
                thumbnailResponse(object),
                CachePolicy.PUBLIC_CACHE
            );
        }

        // Never answer with the element's default, which would show the wrong part.
        // Signed out there is no session to render under.
        if (
            configurationKey !== DEFAULT_CONFIGURATION_KEY &&
            insertableId &&
            (await isSignedIn(c))
        ) {
            await requestRender(c, {
                insertableId,
                elementId,
                configurationKey,
                microversionId
            });
        }
        return notRenderedYet();
    }
);

/** Nothing to serve yet, and a render landing later must not be shadowed. */
function notRenderedYet(): Response {
    return setCache(
        new Response(null, { status: HttpStatus.NOT_FOUND }),
        CachePolicy.NO_CACHE
    );
}

function thumbnailResponse(object: R2ObjectBody): Response {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
}

const reloadThumbnailBody = z.object({
    /** Exactly one: a group's own thumbnail, or one element's. */
    groupId: z.string().min(1).optional(),
    insertableId: z.string().min(1).optional()
});

/** An editor of the library whose group or insertable the body names. */
const requireThumbnailEditor = requireEditor(async (c) => {
    const body = await c.req.json<z.infer<typeof reloadThumbnailBody>>();
    const db = getDb(c.env.DB);
    if (body.insertableId) {
        return libraryOfInsertable(db, body.insertableId);
    }
    return body.groupId ? libraryOfGroup(db, body.groupId) : undefined;
});

/** POST /api/reload-thumbnail: refetches one thumbnail, since loads don't wait for them. */
thumbnailRoutes.post(
    "/reload-thumbnail",
    requireThumbnailEditor,
    validate("json", reloadThumbnailBody),
    async (c) => {
        const { groupId, insertableId } = c.req.valid("json");
        const db = getDb(c.env.DB);
        const onshapeApi = await c.var.getOnshapeApi();

        if (insertableId) {
            await reloadInsertableThumbnail(
                db,
                c.env.BLOB,
                onshapeApi,
                insertableId
            );
        } else if (groupId) {
            await reloadGroupThumbnail(db, c.env.BLOB, onshapeApi, groupId);
        } else {
            throw handledError(
                "Name a group or an element to reload.",
                HttpStatus.BAD_REQUEST
            );
        }
        return c.json({ success: true });
    }
);
