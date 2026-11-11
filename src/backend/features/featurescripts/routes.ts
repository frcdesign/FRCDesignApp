import { and, asc, eq, sql } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { getDb } from "../../db/client";
import { handledError } from "../../lib/api-error";
import { finishEvenIfDisconnected } from "../../lib/background";
import { CachePolicy, cacheMiddleware, setCache } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { addPartStudioFeature } from "../../lib/onshape/endpoints/part-studios";
import { CustomFeature } from "../../lib/onshape/objects/custom-feature";
import { toElementPath } from "../../lib/onshape/path";
import { retryInsert } from "../../lib/onshape/retry";
import { validate } from "../../lib/validate";
import {
    requireOwnerMiddleware,
    requireSignInMiddleware
} from "../auth/guards";
import {
    type AddFeatureScriptOut,
    addFeatureScriptBody,
    type FeatureScriptFavoritesOut,
    featureScriptVisibilityBody,
    type FeatureScriptsVersionOut
} from "./contract";
import {
    featureScriptFavorites,
    featureScripts,
    featureScriptsDocument
} from "./schema";
import { getCacheVersion, getFeatureScriptsOut, iconKey } from "./store";

export const featureScriptRoutes = getApp();

/** GET /api/featurescripts-version — keys the `?v=` below. */
featureScriptRoutes.get(
    "/featurescripts-version",
    cacheMiddleware(),
    async (c) =>
        c.json({
            version: await getCacheVersion(getDb(c.env.DB))
        } satisfies FeatureScriptsVersionOut)
);

/** GET /api/featurescripts?v=:cacheVersion. The same for every caller: the client hides what only the owner sees. */
featureScriptRoutes.get(
    "/featurescripts",
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    async (c) => c.json(await getFeatureScriptsOut(getDb(c.env.DB)))
);

const iconParams = z.object({ elementId: z.string().min(1) });
const iconQuery = z.object({ v: z.string().min(1) });

/**
 * GET /api/featurescripts/icon/:elementId?v=:microversionId. Sandboxed, since
 * an SVG can carry script; the client only ever shows it in an `<img>`.
 */
featureScriptRoutes.get(
    "/featurescripts/icon/:elementId",
    validate("param", iconParams),
    validate("query", iconQuery),
    async (c) => {
        const { elementId } = c.req.valid("param");
        const { v: microversionId } = c.req.valid("query");
        const object = await c.env.BLOB.get(iconKey(elementId, microversionId));
        if (!object) {
            return setCache(
                new Response(null, { status: HttpStatus.NOT_FOUND }),
                CachePolicy.NO_CACHE
            );
        }
        const headers = new Headers({
            "Content-Type": "image/svg+xml",
            "Content-Security-Policy": "sandbox"
        });
        return setCache(
            new Response(object.body, { headers }),
            CachePolicy.PUBLIC_CACHE
        );
    }
);

/** POST /api/featurescripts/:featureId/add */
featureScriptRoutes.post(
    "/featurescripts/:featureId/add",
    requireSignInMiddleware,
    validate("json", addFeatureScriptBody),
    // Onshape may get the feature even if the panel goes away.
    (c) =>
        finishEvenIfDisconnected(
            c,
            (async () => {
                const onshapeApi = await c.var.getOnshapeApi();
                const { targetPath } = c.req.valid("json");
                const db = getDb(c.env.DB);

                const [row, document] = await Promise.all([
                    db
                        .select({
                            elementId: featureScripts.elementId,
                            microversionId: featureScripts.microversionId,
                            featureType: featureScripts.featureType,
                            name: featureScripts.name
                        })
                        .from(featureScripts)
                        .where(eq(featureScripts.id, c.req.param("featureId")))
                        .get(),
                    db.select().from(featureScriptsDocument).get()
                ]);
                if (!row || !document) {
                    throw handledError(
                        "That FeatureScript is no longer available. Reload the app and try again.",
                        HttpStatus.NOT_FOUND
                    );
                }

                const feature = new CustomFeature(
                    row.featureType,
                    row.name,
                    toElementPath({
                        documentId: document.documentId,
                        versionId: document.versionId,
                        elementId: row.elementId
                    }),
                    row.microversionId
                );
                const result = await retryInsert((timeoutMs) =>
                    addPartStudioFeature(
                        onshapeApi,
                        targetPath,
                        feature.getFeature(),
                        timeoutMs
                    )
                );
                return c.json({
                    featureId: result.feature?.featureId
                } satisfies AddFeatureScriptOut);
            })()
        )
);

/** GET /api/featurescripts/favorites — the caller's own, so never cached. */
featureScriptRoutes.get(
    "/featurescripts/favorites",
    requireSignInMiddleware,
    cacheMiddleware(),
    async (c) => {
        const rows = await getDb(c.env.DB)
            .select({ id: featureScriptFavorites.featureScriptId })
            .from(featureScriptFavorites)
            .where(eq(featureScriptFavorites.userId, await c.var.getUserId()))
            // rowid breaks a tie within a millisecond, by which was inserted first.
            .orderBy(asc(featureScriptFavorites.createdAt), sql`rowid`);
        return c.json({
            featureScriptIds: rows.map((row) => row.id)
        } satisfies FeatureScriptFavoritesOut);
    }
);

/** POST /api/featurescripts/:featureId/favorite. Favoriting twice is a no-op. */
featureScriptRoutes.post(
    "/featurescripts/:featureId/favorite",
    requireSignInMiddleware,
    async (c) => {
        const db = getDb(c.env.DB);
        const featureScriptId = c.req.param("featureId");
        const feature = await db
            .select({ id: featureScripts.id })
            .from(featureScripts)
            .where(eq(featureScripts.id, featureScriptId))
            .get();
        if (!feature) {
            throw handledError(
                "That FeatureScript is no longer available. Reload the app and try again.",
                HttpStatus.NOT_FOUND
            );
        }
        await db
            .insert(featureScriptFavorites)
            .values({
                userId: await c.var.getUserId(),
                featureScriptId,
                createdAt: new Date()
            })
            .onConflictDoNothing();
        return c.json({ success: true });
    }
);

/** DELETE /api/featurescripts/:featureId/favorite. Unfavoriting what isn't is a no-op. */
featureScriptRoutes.delete(
    "/featurescripts/:featureId/favorite",
    requireSignInMiddleware,
    async (c) => {
        await getDb(c.env.DB)
            .delete(featureScriptFavorites)
            .where(
                and(
                    eq(featureScriptFavorites.userId, await c.var.getUserId()),
                    eq(
                        featureScriptFavorites.featureScriptId,
                        c.req.param("featureId")
                    )
                )
            );
        return c.json({ success: true });
    }
);

/**
 * POST /api/featurescripts/:featureId/visibility. The owner's alone; bumps
 * the cache version, since every caller's list is cached under it.
 */
featureScriptRoutes.post(
    "/featurescripts/:featureId/visibility",
    requireOwnerMiddleware,
    validate("json", featureScriptVisibilityBody),
    async (c) => {
        const db = getDb(c.env.DB);
        const { isVisible } = c.req.valid("json");
        const updated = await db
            .update(featureScripts)
            .set({ isVisible })
            .where(eq(featureScripts.id, c.req.param("featureId")))
            .returning({ id: featureScripts.id });
        if (updated.length === 0) {
            throw handledError(
                "That FeatureScript is no longer available. Reload the app and try again.",
                HttpStatus.NOT_FOUND
            );
        }
        await db.update(featureScriptsDocument).set({
            cacheVersion: sql`${featureScriptsDocument.cacheVersion} + 1`
        });
        return c.json({ success: true });
    }
);
