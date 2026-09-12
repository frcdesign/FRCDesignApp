import { type ConfigurationKey } from "../configurations/contract";
import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { insertables } from "../../db/schema";
import { createLimiter, getOnshapeApiFromContext } from "../load/context";
import { THUMBNAIL_STEP_RETRIES } from "../load/steps";
import { NoSuchConfigurationError } from "../../lib/onshape/endpoints/thumbnails";
import { uploadConfigurationThumbnails } from "./store";

/** The render to run, plus the session whose Onshape tokens it runs under. */
export interface ThumbnailWorkflowParams {
    insertableId: string;
    /** Never the default, which loads eagerly with the element. */
    configurationKey: ConfigurationKey;
    /** The microversion asked for, which is what makes the run id unique. */
    microversionId: string;
    sessionId: string;
}

/**
 * Names the render rather than the run, so asking twice is asking once. Hashed
 * because a configuration key carries `=`, `;` and `%`, and this has to be one
 * plain token; sha-256 rather than anything shorter so two keys cannot collide
 * onto one render.
 */
export async function thumbnailRunId({
    insertableId,
    configurationKey,
    microversionId
}: Omit<ThumbnailWorkflowParams, "sessionId">): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
            `${insertableId}\n${microversionId}\n${configurationKey}`
        )
    );
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Outside a request, since Onshape can take minutes. Until it finishes, the
 * route answers this configuration with a miss and the client polls.
 */
export class ThumbnailWorkflow extends WorkflowEntrypoint<
    AppBindings,
    ThumbnailWorkflowParams
> {
    async run(
        event: WorkflowEvent<ThumbnailWorkflowParams>,
        step: WorkflowStep
    ): Promise<void> {
        const { insertableId, configurationKey, sessionId } = event.payload;

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
            async () => {
                try {
                    await uploadConfigurationThumbnails(
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
                        configurationKey
                    );
                } catch (error) {
                    // Retrying asks Onshape the same question for the same
                    // answer. The route restarts a run that ended, so spending
                    // the step's attempts here spends them again per poll.
                    if (error instanceof NoSuchConfigurationError) {
                        throw new NonRetryableError(error.message);
                    }
                    throw error;
                }
            }
        );
    }
}
