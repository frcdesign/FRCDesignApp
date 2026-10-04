/** Starts a configuration's render once; asking again while it runs starts nothing. */
import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import type { AppContext } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { configurations, groups, insertables } from "../../db/schema";
import { type ElementPath } from "../../lib/onshape/path";
import { getEncodedConfiguration } from "../../lib/onshape/endpoints/thumbnails";
import { getSessionId } from "../auth/session";
import {
    type ConfigurationKey,
    type ConfigurationParameter,
    DEFAULT_CONFIGURATION_KEY,
    type PartialSelection
} from "../configurations/contract";
import {
    renderOverrides,
    toKey,
    toSelection
} from "../configurations/selection";
import { RenderStatus, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { isWorkflowActive } from "../../lib/workflows";

interface RenderRequest {
    insertableId: string;
    /** As entered; the key it is stored under is derived here, not trusted. */
    selection: PartialSelection;
}

/**
 * Renders from the insertable's current microversion, in its group's thumbnail
 * workspace. A group without one is refused, since branching one takes edit
 * access the caller may not have; its next load branches it.
 */
export async function requestRender(
    c: AppContext,
    request: RenderRequest
): Promise<RenderStatus> {
    const sessionId = getSessionId(c);
    const target = await renderTargetOf(c, request.insertableId);
    const { parameters } = target;
    const selection = toSelection(request.selection, parameters);
    const configurationKey = toKey(selection, parameters);
    if (configurationKey === DEFAULT_CONFIGURATION_KEY) {
        throw handledError(
            "The default configuration's thumbnail is stored with the part.",
            HttpStatus.BAD_REQUEST
        );
    }
    if (!target.workspacePath) {
        console.warn("No thumbnail workspace to render from", request);
        throw handledError(
            "This part can't preview configurations until its library reloads.",
            HttpStatus.SERVICE_UNAVAILABLE
        );
    }
    const { workspacePath } = target;
    const encodedConfiguration = await getEncodedConfiguration(
        await c.var.getOnshapeApi(),
        workspacePath,
        renderOverrides(selection, parameters)
    );
    if (!encodedConfiguration) {
        return RenderStatus.NO_PART;
    }
    const { elementId, microversionId } = target;

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
        if (!isWorkflowActive(status)) {
            await existing.restart();
        }
        return RenderStatus.RENDERING;
    }

    try {
        await workflow.create({
            id,
            params: {
                workspacePath,
                encodedConfiguration,
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
 * Keyed by where the render is stored, so restarting one never stores its
 * bytes under another configuration's key. Hashed to fit an instance id.
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
    return `configured-render-${hex}`;
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
    /** Empty for an insertable with nothing to configure. */
    parameters: ConfigurationParameter[];
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
            thumbnailWorkspaceId: groups.thumbnailWorkspaceId,
            parameters: configurations.parameters
        })
        .from(insertables)
        .innerJoin(groups, eq(groups.id, insertables.groupId))
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(eq(insertables.id, insertableId))
        .get();
    if (!row) {
        throw handledError("No such part.", HttpStatus.NOT_FOUND);
    }
    const { elementId, microversionId, thumbnailWorkspaceId } = row;
    return {
        elementId,
        microversionId,
        parameters: row.parameters ?? [],
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
