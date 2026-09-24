/** Starts a configuration's render once; asking again while it runs starts nothing. */
import { eq } from "drizzle-orm";
import { HttpStatus } from "http-status-ts";
import type { AppContext } from "../../lib/context";
import { handledError } from "../../lib/api-error";
import { getDb } from "../../db/client";
import { groups, insertables } from "../../db/schema";
import { type ElementPath, toElementPath } from "../../lib/onshape/path";
import { getThumbnailId } from "../../lib/onshape/endpoints/thumbnails";
import { getSessionId } from "../auth/session";
import { type ConfigurationKey } from "../configurations/contract";
import { decodeConfiguration } from "../configurations/utils";
import { ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";

interface RenderRequest {
    /** What the element path is resolved from, since the caller has only this. */
    insertableId: string;
    elementId: string;
    microversionId: string;
    configurationKey: ConfigurationKey;
}

/** Statuses of an instance still working towards its bytes. */
const ACTIVE = new Set<InstanceStatus["status"]>([
    "queued",
    "running",
    "waiting",
    "paused",
    "waitingForPause"
]);

/** Throws a handled 422 when Onshape has no part for the configuration. */
export async function requestRender(
    c: AppContext,
    request: RenderRequest
): Promise<void> {
    const sessionId = getSessionId(c);
    const thumbnailId = await getThumbnailId(
        await c.var.getOnshapeApi(),
        await elementPathOf(c, request.insertableId),
        decodeConfiguration(request.configurationKey)
    );
    if (!thumbnailId) {
        throw handledError(
            "Onshape has no part for this configuration.",
            HttpStatus.UNPROCESSABLE_ENTITY
        );
    }

    const workflow = c.env.RENDER_THUMBNAIL_WORKFLOW;
    const id = renderInstanceId(thumbnailId);
    const existing = await findInstance(workflow, id);
    if (existing) {
        const { status } = await existing.status();
        // Only a miss gets here, so a finished instance left no bytes behind.
        if (!ACTIVE.has(status)) {
            await existing.restart();
        }
        return;
    }

    try {
        await workflow.create({
            id,
            params: {
                thumbnailId,
                targets: Object.values(ThumbnailSize).map((size) => ({
                    size,
                    key: thumbnailKey(
                        request.elementId,
                        request.microversionId,
                        size,
                        request.configurationKey
                    )
                })),
                elementId: request.elementId,
                microversionId: request.microversionId,
                configurationKey: request.configurationKey,
                sessionId
            }
        });
    } catch (error) {
        // Two requests racing to start the same render; the other one won.
        if (!(await findInstance(workflow, id))) {
            throw error;
        }
    }
}

/**
 * Onshape serves the bytes by this id alone, so it pins element, version and
 * configuration. Its format is undocumented, so disallowed characters are replaced.
 */
function renderInstanceId(thumbnailId: string): string {
    return `render-${thumbnailId.replace(/[^\w-]/g, "_")}`.slice(0, 100);
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

/** Read rather than passed in, since a request can carry a version the group has moved past. */
async function elementPathOf(
    c: AppContext,
    insertableId: string
): Promise<ElementPath> {
    const row = await getDb(c.env.DB)
        .select({
            documentId: insertables.documentId,
            versionId: insertables.versionId,
            elementId: insertables.elementId,
            thumbnailWorkspaceId: groups.thumbnailWorkspaceId
        })
        .from(insertables)
        .innerJoin(groups, eq(groups.id, insertables.groupId))
        .where(eq(insertables.id, insertableId))
        .get();
    if (!row) {
        throw handledError("No such part.", HttpStatus.NOT_FOUND);
    }
    if (!row.thumbnailWorkspaceId) {
        return toElementPath(row);
    }
    return {
        documentId: row.documentId,
        instanceId: row.thumbnailWorkspaceId,
        instanceType: "w",
        elementId: row.elementId
    };
}
