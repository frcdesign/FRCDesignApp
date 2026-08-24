import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { insertables } from "../../db/schema";
import { createLimiter, getOnshapeApiFromContext } from "../load/context";
import { THUMBNAIL_STEP_RETRIES } from "../load/steps";
import { uploadConfigurationThumbnails } from "./store";

/** The render to run, plus the session whose Onshape tokens it runs under. */
export interface ThumbnailWorkflowParams {
    insertableId: string;
    /** Never the default, which loads eagerly with the element. */
    canonicalConfiguration: string;
    sessionId: string;
}

/**
 * Outside a request, since Onshape can take minutes. Until it finishes,
 * requests fall back to the element's default thumbnail.
 */
export class ThumbnailWorkflow extends WorkflowEntrypoint<
    AppBindings,
    ThumbnailWorkflowParams
> {
    async run(
        event: WorkflowEvent<ThumbnailWorkflowParams>,
        step: WorkflowStep
    ): Promise<void> {
        const { insertableId, canonicalConfiguration, sessionId } =
            event.payload;

        // Read rather than passed in: the stored row is what the key has to
        // agree with, and a request can carry a microversion it has moved past.
        const element = await step.do("resolve-element", async () => {
            const row = await getDb(this.env.DB)
                .select({
                    documentId: insertables.documentId,
                    versionId: insertables.versionId,
                    elementId: insertables.elementId,
                    microversionId: insertables.microversionId
                })
                .from(insertables)
                .where(eq(insertables.id, insertableId))
                .get();
            if (!row) {
                throw new Error(`No insertable ${insertableId}`);
            }
            return row;
        });

        await step.do(
            "render-thumbnails",
            { retries: THUMBNAIL_STEP_RETRIES },
            async () =>
                uploadConfigurationThumbnails(
                    this.env.BLOB,
                    await getOnshapeApiFromContext({
                        env: this.env,
                        sessionId,
                        step,
                        limit: createLimiter(1)
                    }),
                    {
                        documentId: element.documentId,
                        instanceId: element.versionId,
                        instanceType: "v" as const,
                        elementId: element.elementId
                    },
                    element.microversionId,
                    canonicalConfiguration
                )
        );
    }
}
