import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { forbiddenError, handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import type { OnshapeApi } from "../../lib/onshape/client";
import {
    hasPermissions,
    OnshapePermission
} from "../../lib/onshape/endpoints/permissions";
import {
    getWorkspaceLinkParam,
    workspaceLinkRoute
} from "../../lib/route-params";
import { getDb } from "../../db/client";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { getSessionId } from "../auth/session";
import {
    isSameWorkspace,
    LinkDirection,
    MAX_VERSION_NAME_LENGTH,
    toWorkspacePath,
    type LinkedWorkspace,
    type WorkspacePath
} from "./contract";
import { LinkCycleError, pushOrder } from "./graph";
import { getJobStatus, rememberJob } from "./jobs";
import {
    addLink,
    collectDescendantEdges,
    deleteLink,
    getChildLinks,
    getLink,
    getParentLinks,
    otherEnd,
    toEdge,
    toLinkedWorkspace
} from "./links";
import type { PushStep } from "./workflow";

export const versionManagerRoutes = getApp();

/** Fixed to a workspace: a version has no references to update. */
const workspaceSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1)
});

const workspaceQuery = workspaceSchema;

const jobQuery = workspaceSchema.extend({
    /** The run the client is watching; without one, the workspace's latest. */
    jobId: z.string().min(1).optional()
});

const addLinkBody = z.object({
    workspace: workspaceSchema,
    linked: workspaceSchema,
    direction: z.enum(LinkDirection)
});

/** A scope that names one linked workspace, which both directions have. */
const oneScope = z.object({
    kind: z.literal("one"),
    workspace: workspaceSchema
});

const pushScope = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("direct") }),
    z.object({ kind: z.literal("recursive") }),
    oneScope
]);

const pullScope = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("parents") }),
    z.object({ kind: z.literal("all") }),
    oneScope
]);

const pushBody = z.object({
    workspace: workspaceSchema,
    name: z.string().min(1).max(MAX_VERSION_NAME_LENGTH),
    description: z.string().max(10_000).optional(),
    scope: pushScope.default({ kind: "direct" })
});

const pullBody = z.object({
    workspace: workspaceSchema,
    scope: pullScope.default({ kind: "parents" })
});

type WorkspaceInput = z.infer<typeof workspaceSchema>;

// The parsed scopes, whose workspace is the wire's two ids rather than the
// contract's whole path; `toWorkspace` is what makes one of the other.
type PushScopeInput = z.infer<typeof pushScope>;
type PullScopeInput = z.infer<typeof pullScope>;

function toWorkspace(input: WorkspaceInput): WorkspacePath {
    return toWorkspacePath(input.documentId, input.instanceId);
}

/**
 * Onshape decides what may be done here, not the app's own access levels: these
 * are the caller's documents, and the library has no say over them.
 */
async function requirePermissions(
    client: OnshapeApi,
    workspace: WorkspacePath,
    what: string,
    ...needed: OnshapePermission[]
): Promise<void> {
    if (!(await hasPermissions(client, workspace, ...needed))) {
        throw forbiddenError(
            `You do not have permission to ${what} in Onshape.`
        );
    }
}

/** GET /api/workspace-links?documentId=&instanceId= */
versionManagerRoutes.get(
    "/workspace-links",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceQuery),
    async (c) => {
        const workspace = toWorkspace(c.req.valid("query"));
        const client = await c.var.getOnshapeApi();
        await requirePermissions(
            client,
            workspace,
            "read this document",
            OnshapePermission.READ
        );

        const db = getDb(c.env.DB);
        const [parentRows, childRows] = await Promise.all([
            getParentLinks(db, workspace),
            getChildLinks(db, workspace)
        ]);

        const describe = (rows: typeof parentRows) =>
            Promise.all(
                rows.map((row) =>
                    toLinkedWorkspace(client, row.id, otherEnd(row, workspace))
                )
            );
        const [parents, children]: LinkedWorkspace[][] = await Promise.all([
            describe(parentRows),
            describe(childRows)
        ]);

        return c.json({ parents, children });
    }
);

/** POST /api/workspace-links */
versionManagerRoutes.post(
    "/workspace-links",
    requireSignInMiddleware,
    validate("json", addLinkBody),
    async (c) => {
        const body = c.req.valid("json");
        const workspace = toWorkspace(body.workspace);
        const linked = toWorkspace(body.linked);

        if (isSameWorkspace(workspace, linked)) {
            throw handledError(
                "A workspace cannot be linked to itself.",
                HttpStatus.BAD_REQUEST
            );
        }

        const client = await c.var.getOnshapeApi();
        await requirePermissions(
            client,
            workspace,
            "edit this document",
            OnshapePermission.WRITE
        );
        await requirePermissions(
            client,
            linked,
            "read the document you linked",
            OnshapePermission.READ
        );

        // A parent provides to this workspace; a child takes from it.
        const [parent, child] =
            body.direction === LinkDirection.PARENT
                ? [linked, workspace]
                : [workspace, linked];
        await addLink(getDb(c.env.DB), parent, child);

        return c.json({ success: true });
    }
);

/** DELETE /api/workspace-link/:linkId */
versionManagerRoutes.delete(
    workspaceLinkRoute(),
    requireSignInMiddleware,
    async (c) => {
        const linkId = getWorkspaceLinkParam(c);
        const db = getDb(c.env.DB);
        const row = await getLink(db, linkId);
        // Gone already is the state the caller wanted.
        if (!row) return c.json({ success: true });

        // Either end: a link belongs to both workspaces, so being able to edit
        // one of them is enough to take it back.
        const client = await c.var.getOnshapeApi();
        const { parent, child } = toEdge(row);
        const allowed = await Promise.all([
            hasPermissions(client, parent, OnshapePermission.WRITE),
            hasPermissions(client, child, OnshapePermission.WRITE)
        ]);
        if (!allowed.some(Boolean)) {
            throw forbiddenError(
                "You do not have permission to edit either of the linked documents."
            );
        }

        await deleteLink(db, linkId);
        return c.json({ success: true });
    }
);

/** POST /api/push-version */
versionManagerRoutes.post(
    "/push-version",
    requireSignInMiddleware,
    validate("json", pushBody),
    async (c) => {
        const body = c.req.valid("json");
        const { name, description = "", scope } = body;
        const workspace = toWorkspace(body.workspace);
        const client = await c.var.getOnshapeApi();

        const order = await resolvePushOrder(c, workspace, scope);
        // Only the recursive walk versions what it passes through; it is the
        // one scope whose later steps need a version to reference.
        const steps: PushStep[] = order.map((each) => ({
            workspace: each,
            createVersion: scope.kind === "recursive"
        }));

        // Checked across the whole run before it starts: a push that cuts a
        // version and then finds it cannot finish has already changed the
        // document it was called on.
        await requirePermissions(
            client,
            workspace,
            "create a version in this document",
            OnshapePermission.WRITE,
            OnshapePermission.LINK
        );
        for (const step of steps) {
            await requirePermissions(
                client,
                step.workspace,
                "update every linked document this push would write to",
                OnshapePermission.WRITE,
                // Only when the run versions it, which makes it the source of
                // the references the workspaces past it carry.
                ...(step.createVersion ? [OnshapePermission.LINK] : [])
            );
        }

        const instance = await c.env.VERSION_MANAGER_WORKFLOW.create({
            params: {
                kind: "push",
                sessionId: getSessionId(c),
                workspace,
                name,
                description,
                steps
            }
        });
        await rememberJob(c.env, workspace, instance.id);

        return c.json({ jobId: instance.id });
    }
);

/**
 * The workspaces the push has to update, in order, with the two ways the graph
 * can refuse to give one turned into something the caller can act on.
 */
async function resolvePushOrder(
    c: AppContext,
    workspace: WorkspacePath,
    scope: PushScopeInput
): Promise<WorkspacePath[]> {
    const db = getDb(c.env.DB);
    const recursive = scope.kind === "recursive";
    const edges = recursive
        ? await collectDescendantEdges(db, workspace)
        : (await getChildLinks(db, workspace)).map(toEdge);

    let order: WorkspacePath[];
    try {
        order = pushOrder(edges, workspace, recursive);
    } catch (error) {
        if (error instanceof LinkCycleError) {
            throw handledError(
                "The linked workspaces form a loop, so there is no order to push them in. Remove a link and try again.",
                HttpStatus.CONFLICT
            );
        }
        throw error;
    }

    if (scope.kind === "one") {
        // Narrowed rather than trusted: a workspace nobody linked is not one
        // this push has any business writing to.
        const target = toWorkspace(scope.workspace);
        const linked = order.find((each) => isSameWorkspace(each, target));
        if (!linked) {
            throw handledError(
                "That workspace is no longer a child of this one.",
                HttpStatus.CONFLICT
            );
        }
        return [linked];
    }

    // A version is pinned per document, so one document appearing twice leaves
    // the references of everything downstream pointing at whichever was cut
    // last. Refused rather than guessed at.
    const documentIds = [workspace, ...order].map((each) => each.documentId);
    if (new Set(documentIds).size !== documentIds.length) {
        throw handledError(
            "This push would version two workspaces of the same document. Push them one at a time.",
            HttpStatus.CONFLICT
        );
    }
    return order;
}

/** POST /api/pull-references */
versionManagerRoutes.post(
    "/pull-references",
    requireSignInMiddleware,
    validate("json", pullBody),
    async (c) => {
        const body = c.req.valid("json");
        const { scope } = body;
        const workspace = toWorkspace(body.workspace);

        const client = await c.var.getOnshapeApi();
        await requirePermissions(
            client,
            workspace,
            "edit this document",
            OnshapePermission.WRITE
        );

        const sourceDocumentIds = await resolvePullSources(c, workspace, scope);

        const instance = await c.env.VERSION_MANAGER_WORKFLOW.create({
            params: {
                kind: "pull",
                sessionId: getSessionId(c),
                workspace,
                sourceDocumentIds
            }
        });
        await rememberJob(c.env, workspace, instance.id);

        return c.json({ jobId: instance.id });
    }
);

/**
 * The documents a pull takes its versions from, or undefined for all of them.
 * Narrowed to the parents, so a pull only moves references the graph accounts
 * for.
 */
async function resolvePullSources(
    c: AppContext,
    workspace: WorkspacePath,
    scope: PullScopeInput
): Promise<string[] | undefined> {
    if (scope.kind === "all") {
        return undefined;
    }

    const rows = await getParentLinks(getDb(c.env.DB), workspace);
    if (scope.kind === "one") {
        const parent = toWorkspace(scope.workspace);
        const row = rows.find((each) =>
            isSameWorkspace(toEdge(each).parent, parent)
        );
        if (!row) {
            throw handledError(
                "That workspace is no longer a parent of this one.",
                HttpStatus.CONFLICT
            );
        }
        return [row.sourceDocumentId];
    }

    if (rows.length === 0) {
        throw handledError(
            "This workspace has no parents to pull from.",
            HttpStatus.CONFLICT
        );
    }
    return rows.map((row) => row.sourceDocumentId);
}

/** GET /api/version-job?documentId=&instanceId=&jobId= */
versionManagerRoutes.get(
    "/version-job",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", jobQuery),
    async (c) => {
        const query = c.req.valid("query");
        const status = await getJobStatus(
            c.env,
            toWorkspace(query),
            query.jobId
        );
        return c.json(status);
    }
);
