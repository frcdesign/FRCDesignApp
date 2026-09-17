import z from "zod";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { INSTANCE_TYPES } from "../../lib/onshape/path";
import {
    addFeatureToAssembly,
    getAssemblyBoundingBox
} from "../../lib/onshape/endpoints/assemblies";
import { toTranslation } from "../../lib/onshape/objects/transform";
import {
    INSERT_LOCATION_SKETCH_ID,
    INSERT_LOCATION_SOURCE,
    type InsertLocationOut
} from "./contract";
import { findInsertLocation } from "./parse";
import { toMarkerPoint } from "./placement";

export const insertLocationRoutes = getApp();

/** The assembly being inserted into; the app only ever asks about its own tab. */
const assemblyPathSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    elementId: z.string().min(1)
});

/** GET /api/insert-location?documentId=…&instanceId=…&instanceType=…&elementId=… */
insertLocationRoutes.get(
    "/insert-location",
    requireSignInMiddleware,
    validate("query", assemblyPathSchema),
    async (c) => {
        const instanceId = await findInsertLocation(
            await c.var.getOnshapeApi(),
            c.req.valid("query")
        );
        return c.json({ instanceId } satisfies InsertLocationOut);
    }
);

/** POST /api/insert-location */
insertLocationRoutes.post(
    "/insert-location",
    requireSignInMiddleware,
    validate("json", z.object({ targetPath: assemblyPathSchema })),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const { targetPath } = c.req.valid("json");

        // A second marker would leave the lookup picking between them, so an
        // assembly that already has one keeps it.
        const existing = await findInsertLocation(onshapeApi, targetPath);
        if (existing) {
            return c.json({
                instanceId: existing
            } satisfies InsertLocationOut);
        }

        // Clear of the geometry, so the marker can be grabbed and dragged.
        // A box we cannot read is not a reason to refuse to add one.
        const box = await getAssemblyBoundingBox(onshapeApi, targetPath).catch(
            () => undefined
        );

        const inserted = await addFeatureToAssembly(
            onshapeApi,
            targetPath,
            INSERT_LOCATION_SOURCE,
            INSERT_LOCATION_SKETCH_ID,
            toTranslation(toMarkerPoint(box))
        );

        // The insert answers with the occurrence it made, whose path is the new
        // instance's own id. Looked up again if it did not, rather than leaving
        // the caller thinking the marker is still missing.
        const instanceId =
            inserted.insertInstanceResponses?.[0]?.occurrences?.[0]?.path[0] ??
            (await findInsertLocation(onshapeApi, targetPath));

        return c.json({ instanceId } satisfies InsertLocationOut);
    }
);
