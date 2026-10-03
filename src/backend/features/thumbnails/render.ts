/** Starts a configuration's render once; asking again while it runs starts nothing. */
import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import type { AppContext } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import { type ElementPath } from "../../lib/onshape/path";
import { getThumbnailId } from "../../lib/onshape/endpoints/thumbnails";
import { getSessionId } from "../auth/session";
import { type ConfigurationKey } from "../configurations/contract";
import { decodeConfiguration } from "../configurations/utils";
import { RenderStatus, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { isInstanceActive } from "../../lib/workflows";

interface RenderRequest {
    insertableId: string;
    configurationKey: ConfigurationKey;
}

/**
 * Renders from the insertable's current microversion, in its group's thumbnail
 * workspace; a group without one has it after its next load.
 */
export async function requestRender(
    c: AppContext,
    request: RenderRequest
): Promise<RenderStatus> {
    const sessionId = getSessionId(c);
    const target = await renderTargetOf(c, request.insertableId);
    if (!target.workspacePath) {
        console.warn("No thumbnail workspace to render from", request);
        return RenderStatus.RENDERING;
    }
    const thumbnailId = await getThumbnailId(
        await c.var.getOnshapeApi(),
        target.workspacePath,
        decodeConfiguration(request.configurationKey)
    );
    if (!thumbnailId) {
        return RenderStatus.NO_PART;
    }
    const { elementId, microversionId } = target;
    const { configurationKey } = request;

    const workflow = c.env.RENDER_THUMBNAIL_WORKFLOW;
    const id = await renderInstanceId(
        elementId,
        microversionId,
        configurationKey
    );
    const existing = await findInstance(workflow, id);
    if (existing) {
        const { status } = await existing.status();
        // A finished one restarts, and returns at once if its bytes are stored.
        if (!isInstanceActive(status)) {
            await existing.restart();
        }
        return RenderStatus.RENDERING;
    }

    try {
        await workflow.create({
            id,
            params: {
                thumbnailId,
                targets: Object.values(ThumbnailSize).map((size) => ({
                    size,
                    key: thumbnailKey(
                        elementId,
                        microversionId,
                        size,
                        configurationKey
                    )
                })),
                elementId,
                microversionId,
                configurationKey,
                sessionId
            }
        });
    } catch (error) {
        // Two requests racing to start the same render; the other one won.
        if (!(await findInstance(workflow, id))) {
            throw error;
        }
    }
    return RenderStatus.RENDERING;
}

/**
 * Keyed by where the render is stored, not by Onshape's thumbnail id: two
 * configurations can share that id, and restarting the other's instance would
 * store its bytes under the other's key. Hashed to fit an instance id.
 */
async function renderInstanceId(
    elementId: string,
    microversionId: string,
    configurationKey: ConfigurationKey
): Promise<string> {
    const subject = `${elementId}/${microversionId}/${configurationKey}`;
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(subject)
    );
    const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");
    return `render-${hex}`;
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

interface RenderTarget {
    elementId: string;
    microversionId: string;
    /** Undefined until the group's next load branches one. */
    workspacePath?: ElementPath;
}

async function renderTargetOf(
    c: AppContext,
    insertableId: string
): Promise<RenderTarget> {
    const row = await getDb(c.env.DB)
        .select({
            documentId: insertables.documentId,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            thumbnailWorkspaceId: groups.thumbnailWorkspaceId
        })
        .from(insertables)
        .innerJoin(groups, eq(groups.id, insertables.groupId))
        .where(eq(insertables.id, insertableId))
        .get();
    if (!row) {
        throw handledError("No such part.", HttpStatus.NOT_FOUND);
    }
    const { elementId, microversionId, thumbnailWorkspaceId } = row;
    return {
        elementId,
        microversionId,
        workspacePath: thumbnailWorkspaceId
            ? {
                  documentId: row.documentId,
                  instanceId: thumbnailWorkspaceId,
                  instanceType: "w",
                  elementId
              }
            : undefined
    };
}
