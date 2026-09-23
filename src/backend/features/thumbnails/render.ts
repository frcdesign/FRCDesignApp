/**
 * Starts a configuration's render, once. The route calls this on every miss —
 * a client polls it until the bytes land — so asking again while a render is
 * under way has to cost nothing.
 */
import { eq } from "drizzle-orm";
import type { AppContext } from "../../lib/context";
import { getDb } from "../../db/client";
import { insertables } from "../../db/schema";
import { toElementPath } from "../../lib/onshape/path";
import {
    getThumbnailId,
    NoSuchConfigurationError
} from "../../lib/onshape/endpoints/thumbnails";
import { getSessionId } from "../auth/session";
import { type ConfigurationKey } from "../configurations/contract";
import { decodeConfiguration } from "../configurations/utils";
import { PREFERRED_SIZE, RenderSource, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import type { RenderTarget } from "./render-workflow";

export interface RenderRequest {
    /** What the element path is resolved from, since the caller has only this. */
    insertableId: string;
    elementId: string;
    microversionId: string;
    configurationKey: ConfigurationKey;
}

/**
 * What asking did: a render is coming, or it cannot — Onshape has no
 * insertable for the configuration, so the caller can say so at once.
 */
export type RenderOutcome = "rendering" | "no-such-configuration";

/** Statuses of an instance still working towards its bytes. */
const ACTIVE = new Set<InstanceStatus["status"]>([
    "queued",
    "running",
    "waiting",
    "paused",
    "waitingForPause"
]);

export async function requestRender(
    c: AppContext,
    request: RenderRequest,
    source: RenderSource
): Promise<RenderOutcome> {
    // First, so a caller with no session to render under spends nothing.
    const sessionId = getSessionId(c);
    const workflow = c.env.RENDER_THUMBNAIL_WORKFLOW;
    const id = await instanceId(request);

    const existing = await findInstance(workflow, id);
    if (existing) {
        const { status } = await existing.status();
        // Only a miss asks, so a finished instance left no bytes behind: its
        // render never came, or what it stored has since been deleted.
        if (!ACTIVE.has(status)) {
            await existing.restart();
        }
        return "rendering";
    }

    // Resolved here rather than in the workflow: it is one quick call, and a
    // configuration Onshape cannot resolve is worth saying so about now.
    let thumbnailId: string;
    try {
        thumbnailId = await getThumbnailId(
            await c.var.getOnshapeApi(),
            await elementPathOf(c, request.insertableId),
            decodeConfiguration(request.configurationKey)
        );
    } catch (error) {
        if (error instanceof NoSuchConfigurationError) {
            return "no-such-configuration";
        }
        throw error;
    }

    try {
        await workflow.create({
            id,
            params: {
                thumbnailId,
                targets: renderTargets(request, source),
                microversionId: request.microversionId,
                configurationKey: request.configurationKey,
                sessionId
            }
        });
    } catch (error) {
        // Two polls racing to start the same render; the other one won.
        if (!(await findInstance(workflow, id))) {
            throw error;
        }
    }
    return "rendering";
}

/** Both sizes, the one the asking surface shows first leading. */
function renderTargets(
    request: RenderRequest,
    source: RenderSource
): RenderTarget[] {
    const preferred = PREFERRED_SIZE[source];
    return Object.values(ThumbnailSize)
        .sort((a, b) => Number(b === preferred) - Number(a === preferred))
        .map((size) => ({
            size,
            key: thumbnailKey(
                request.elementId,
                request.microversionId,
                size,
                request.configurationKey
            )
        }));
}

/**
 * Named by what it renders, so every poll for one render finds the same
 * instance. Hashed: a configuration can run past the 100 characters an id
 * allows, and spells characters an id may not contain.
 */
async function instanceId(request: RenderRequest): Promise<string> {
    const subject = [
        request.elementId,
        request.microversionId,
        request.configurationKey
    ].join("\n");
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(subject)
    );
    return (
        "render-" +
        [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
    );
}

/** Undefined for an id no instance holds, which `get` answers by throwing. */
async function findInstance(
    workflow: Workflow,
    id: string
): Promise<WorkflowInstance | undefined> {
    try {
        return await workflow.get(id);
    } catch {
        return undefined;
    }
}

/** Read rather than passed in: a request can carry a version it has moved past. */
async function elementPathOf(c: AppContext, insertableId: string) {
    const row = await getDb(c.env.DB)
        .select({
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId
        })
        .from(insertables)
        .where(eq(insertables.id, insertableId))
        .get();
    if (!row) {
        throw new NoSuchConfigurationError(`No insertable ${insertableId}`);
    }
    return toElementPath(row);
}
