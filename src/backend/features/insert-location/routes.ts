import z from "zod";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { INSTANCE_TYPES } from "../../lib/onshape/path";
import { addAssemblyFeature } from "../../lib/onshape/endpoints/assemblies";
import { originMateConnector } from "../../lib/onshape/objects/assembly-features";
import { INSERT_LOCATION_NAME, type InsertLocationOut } from "./contract";
import { findInsertLocation } from "./parse";

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
        const mateConnectorId = await findInsertLocation(
            await c.var.getOnshapeApi(),
            c.req.valid("query")
        );
        return c.json({
            mateConnectorId: mateConnectorId ?? null
        } satisfies InsertLocationOut);
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

        // A second one by the same name would leave the lookup picking between
        // them, so an assembly that already has one keeps it.
        const existing = await findInsertLocation(onshapeApi, targetPath);
        if (existing) {
            return c.json({
                mateConnectorId: existing
            } satisfies InsertLocationOut);
        }

        const created = await addAssemblyFeature(
            onshapeApi,
            targetPath,
            originMateConnector(INSERT_LOCATION_NAME)
        );
        return c.json({
            mateConnectorId: created.feature.featureId
        } satisfies InsertLocationOut);
    }
);
