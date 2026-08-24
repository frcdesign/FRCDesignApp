/**
 * The bolt helper: for each circular edge the user picked, a fasten mate whose
 * implicit connector sits at that edge's center — where a bolt would go. The
 * bolt itself is not inserted yet, so the mate has nothing to fasten to.
 */
import z from "zod";
import { HttpStatus } from "http-status-ts";
import { getApp } from "../../lib/context";
import { validate } from "../../lib/validate";
import { handledError, internalError } from "../../lib/api-error";
import { requireSignInMiddleware } from "../auth/guards";
import { addAssemblyFeature } from "../../lib/onshape/endpoints/assemblies";
import {
    getDocumentElement,
    OnshapeElementType
} from "../../lib/onshape/endpoints/documents";
import { INSTANCE_TYPES } from "../../lib/onshape/path";
import {
    FastenMateBuilder,
    implicitMateConnector,
    inferenceQuery,
    makeMateConnector
} from "../../lib/onshape/objects/assembly-features";
import { type BoltHelperResult } from "./contract";

export const boltHelperRoutes = getApp();

/** The tab to work in, sent whole in the body as the insert endpoints do. */
const targetPathSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES),
    elementId: z.string().min(1)
});

const edgeSchema = z.object({
    selectionId: z.string().min(1),
    occurrencePath: z.array(z.string()).default([])
});

const boltHelperBody = z.object({
    targetPath: targetPathSchema,
    edges: z.array(edgeSchema).min(1)
});

/** POST /api/bolt-helper */
boltHelperRoutes.post(
    "/bolt-helper",
    requireSignInMiddleware,
    validate("json", boltHelperBody),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const { targetPath, edges } = c.req.valid("json");

        // Features are only editable in a workspace, and the endpoint below
        // asserts it; caught here so it reads as a message, not a 500.
        if (targetPath.instanceType !== "w") {
            throw handledError(
                "Mates can only be added from a workspace.",
                HttpStatus.BAD_REQUEST
            );
        }

        const element = await getDocumentElement(onshapeApi, targetPath);
        if (!element) {
            throw internalError("Target tab not found", HttpStatus.NOT_FOUND);
        }
        if (element.elementType !== OnshapeElementType.ASSEMBLY) {
            throw handledError(
                "The bolt helper only works in an assembly.",
                HttpStatus.BAD_REQUEST
            );
        }

        // Serially: each add is a feature-list edit, and Onshape rejects the
        // second one when it races the first.
        const featureIds: string[] = [];
        for (const [index, edge] of edges.entries()) {
            const builder = new FastenMateBuilder(`Bolt ${index + 1}`);

            const query = inferenceQuery(edge.selectionId, edge.occurrencePath);
            builder.addMateConnector(implicitMateConnector(query));

            console.log(JSON.stringify(builder.build(), null, 2));

            await addAssemblyFeature(
                onshapeApi,
                targetPath,
                makeMateConnector("Test mate connector", query)
            );

            // CENTER inference on a circular edge lands the connector on the
            // hole's axis, which is what a bolt mates to.
            const result = await addAssemblyFeature(
                onshapeApi,
                targetPath,
                builder.build()
            );
            featureIds.push(result.feature.featureId);
        }

        const result: BoltHelperResult = {
            elementName: element.name,
            featureIds
        };
        return c.json(result);
    }
);
