/** Starts a configuration's render once; asking again while it runs starts nothing. */
import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import type { AppContext } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import { type ElementPath, toElementPath } from "../../lib/onshape/path";
import { getThumbnailId } from "../../lib/onshape/endpoints/thumbnails";
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

/** The insert menu's preview first, since somebody is waiting on it. */
const RENDER_ORDER = [ThumbnailSize.LARGE, ThumbnailSize.SMALL];

interface RenderRequest {
    insertableId: string;
    /** As entered; the key it is stored under is derived here, not trusted. */
    selection: PartialSelection;
}

/** Renders the insertable's current version, which is what the library shows. */
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
    const thumbnailId = await getThumbnailId(
        await c.var.getOnshapeApi(),
        target.path,
        renderOverrides(selection, parameters)
    );
    if (!thumbnailId) {
        return RenderStatus.NO_PART;
    }
    const { elementId } = target.path;
    const { microversionId } = target;

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
                thumbnailId,
                targets: RENDER_ORDER.map((size) => ({
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
    return `version-render-${hex}`;
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
    path: ElementPath;
    microversionId: string;
    /** Empty for an insertable with nothing to configure. */
    parameters: ConfigurationParameter[];
}

async function renderTargetOf(
    c: AppContext,
    insertableId: string
): Promise<RenderTarget> {
    const row = await getDb(c.env.DB)
        .select({
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(eq(insertables.id, insertableId))
        .get();
    if (!row) {
        throw handledError("No such part.", HttpStatus.NOT_FOUND);
    }
    return {
        path: toElementPath(row),
        microversionId: row.microversionId,
        parameters: row.parameters ?? []
    };
}
