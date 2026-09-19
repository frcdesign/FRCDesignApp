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
import { getWorkspaceThumbnail } from "../../lib/onshape/endpoints/thumbnails";
import { getVersions } from "../../lib/onshape/endpoints/versions";
import {
    getWorkspaceLinkParam,
    workspaceLinkRoute
} from "../../lib/route-params";
import { getDb } from "../../db/client";
import { validate } from "../../lib/validate";
import { requireSignInMiddleware } from "../auth/guards";
import { ThumbnailSize } from "../thumbnails/contract";
import { getSessionId } from "../auth/session";
import {
    isSameWorkspace,
    LinkDirection,
    MAX_VERSION_NAME_LENGTH,
    nextVersionName,
    PullScopeKind,
    PushScopeKind,
    toWorkspacePath,
    type LinkedWorkspace,
    type WorkspacePath
} from "./contract";
import {
    descendantKeys,
    LinkCycleError,
    pushOrder,
    workspaceKey
} from "./graph";
import { getJobStatus, rememberJob } from "./jobs";
import {
    addLink,
    collectDescendantEdges,
    deleteLink,
    getChildLinks,
    getLink,
    getParentLinks,
    otherEnd,
    reverseLink,
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

const thumbnailQuery = workspaceSchema.extend({
    /** Which of Onshape's two stored sizes to serve. */
    size: z.enum(ThumbnailSize).default(ThumbnailSize.SMALL)
});

const jobQuery = workspaceSchema.extend({
    /** The run the client is watching; without one, the workspace's latest. */
    jobId: z.string().min(1).optional()
});

const addLinkBody = z.object({
    workspace: workspaceSchema,
    linked: workspaceSchema,
    direction: z.enum(LinkDirection)
});

const moveLinkBody = z.object({
    /** The end the caller is looking from, which the direction is relative to. */
    workspace: workspaceSchema,
    /** What the other end should be once the move is done. */
    direction: z.enum(LinkDirection)
});

const pushScope = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal(PushScopeKind.CHILDREN) }),
    z.object({ kind: z.literal(PushScopeKind.DESCENDANTS) }),
    z.object({
        kind: z.literal(PushScopeKind.ONE),
        workspace: workspaceSchema,
        /** Carries the push on through that child's own descendants. */
        recursive: z.boolean().default(false)
    })
]);

const pullScope = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal(PullScopeKind.PARENTS) }),
    z.object({ kind: z.literal(PullScopeKind.ALL) }),
    z.object({
        kind: z.literal(PullScopeKind.ONE),
        workspace: workspaceSchema
    })
]);

const pushBody = z.object({
    workspace: workspaceSchema,
    /** Absent for a quick push; the workflow names it as Onshape would. */
    name: z.string().min(1).max(MAX_VERSION_NAME_LENGTH).optional(),
    description: z.string().max(10_000).optional(),
    scope: pushScope.default({ kind: PushScopeKind.CHILDREN })
});

const pullBody = z.object({
    workspace: workspaceSchema,
    scope: pullScope.default({ kind: PullScopeKind.PARENTS })
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

/**
 * `GET /api/workspace-links?documentId=&instanceId=`
 *
 * The links either side of a workspace, as {@link WorkspaceLinksData}: the
 * parents it pulls from and the children it pushes to. Each one is resolved
 * against Onshape for its names and the caller's permissions, so a link to
 * something they cannot read comes back unopenable and unnamed.
 *
 * Requires read on the workspace being asked about.
 */
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

/**
 * `POST /api/workspace-links`
 *
 * Links another workspace to this one. The body names the caller's workspace,
 * the one being linked, and which side of the relationship it takes
 * ({@link LinkDirection}). Adding a link that exists is not an error.
 *
 * Requires write on the caller's workspace and read on the one being linked:
 * linking is an edit to this document's graph, and pointing at something they
 * cannot see is not one they should be able to make.
 */
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

/**
 * `DELETE /api/workspace-link/:linkId`
 *
 * Removes a link. Deleting one that is already gone is the state the caller
 * asked for, so it answers success.
 *
 * Requires write on either end: a link belongs to both workspaces, so being
 * able to edit one of them is enough to take it back.
 */
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

/**
 * `POST /api/workspace-link/:linkId/move`
 *
 * Turns a link around: a parent becomes a child, or a child a parent. Answers
 * success where it is already the way round the caller asked for, that being
 * the state they wanted.
 *
 * Requires write on the caller's workspace and read on the other end — a move
 * is an unlink and a link in the other direction, so it asks for what linking
 * asks for.
 */
versionManagerRoutes.post(
    workspaceLinkRoute() + "/move",
    requireSignInMiddleware,
    validate("json", moveLinkBody),
    async (c) => {
        const linkId = getWorkspaceLinkParam(c);
        const body = c.req.valid("json");
        const workspace = toWorkspace(body.workspace);
        const db = getDb(c.env.DB);

        const row = await getLink(db, linkId);
        if (!row) {
            throw handledError(
                "That link no longer exists.",
                HttpStatus.NOT_FOUND
            );
        }

        const edge = toEdge(row);
        const linked = otherEnd(row, workspace);
        if (
            !isSameWorkspace(edge.parent, workspace) &&
            !isSameWorkspace(edge.child, workspace)
        ) {
            throw handledError(
                "That link does not belong to this workspace.",
                HttpStatus.BAD_REQUEST
            );
        }

        // What the other end is now, from the caller's end.
        const current = isSameWorkspace(edge.parent, workspace)
            ? LinkDirection.CHILD
            : LinkDirection.PARENT;
        if (current === body.direction) {
            return c.json({ success: true });
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
            "read the linked document",
            OnshapePermission.READ
        );

        await reverseLink(db, row);
        return c.json({ success: true });
    }
);

/**
 * `POST /api/push-version`
 *
 * Starts a push: cuts a version of the caller's workspace, then moves the
 * references of the children named by {@link PushScope} onto it. An absent
 * `name` is the ordinary case — the run then names each version as Onshape's
 * own dialog would. Answers the run's `jobId`, which `/api/version-job` reports
 * on; the work itself happens in {@link VersionManagerWorkflow}.
 *
 * Requires write and link on the caller's workspace, write on every workspace
 * the run would touch, and link on each one it would version. Checked across
 * the whole run before it starts: a push that cuts a version and then finds it
 * cannot finish has already changed the document it was called on.
 */
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
        // Only a walk that carries on versions what it passes through; it is
        // what the workspaces past this one have to reference.
        const steps: PushStep[] = order.map((each) => ({
            workspace: each,
            createVersion: isRecursive(scope)
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

/** Whether the push carries on past the workspaces it first reaches. */
function isRecursive(scope: PushScopeInput): boolean {
    return (
        scope.kind === PushScopeKind.DESCENDANTS ||
        (scope.kind === PushScopeKind.ONE && scope.recursive)
    );
}

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
    const recursive = isRecursive(scope);
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

    if (scope.kind === PushScopeKind.ONE) {
        // Narrowed rather than trusted: a workspace nobody linked is not one
        // this push has any business writing to.
        const target = toWorkspace(scope.workspace);
        if (!order.some((each) => isSameWorkspace(each, target))) {
            throw handledError(
                "That workspace is no longer a child of this one.",
                HttpStatus.CONFLICT
            );
        }
        // Filtered rather than rebuilt, so what survives keeps the order the
        // whole graph put it in: a workspace fed by two of these still comes
        // after both.
        const kept = descendantKeys(edges, target);
        order = order.filter((each) => kept.has(workspaceKey(each)));
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

/**
 * `POST /api/pull-references`
 *
 * Starts a pull: moves this workspace's out-of-date references onto the latest
 * versions of whatever {@link PullScope} names — its linked parents, one of
 * them, or every document it references. Answers the run's `jobId`.
 *
 * Requires write on the caller's workspace, which is the only one a pull
 * changes.
 */
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
    if (scope.kind === PullScopeKind.ALL) {
        return undefined;
    }

    const rows = await getParentLinks(getDb(c.env.DB), workspace);
    if (scope.kind === PullScopeKind.ONE) {
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

/**
 * `GET /api/version-job?documentId=&instanceId=&jobId=`
 *
 * How a push or pull is going, as {@link VersionJobStatus}, and what it did
 * once it is done. `jobId` names the run the client is watching; without one
 * this answers for whatever the workspace last started, which is how a panel
 * that was closed and reopened finds a run still going.
 */
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

/**
 * `GET /api/next-version-name?documentId=&instanceId=`
 *
 * What a push with no name of its own would call the version it cuts here —
 * `V<n>` after the highest the document already carries, which is what
 * Onshape's own dialog offers. The naming form opens on it, so what it shows is
 * the name that would have been used rather than a guess made without asking.
 *
 * Requires read on the workspace.
 */
versionManagerRoutes.get(
    "/next-version-name",
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
        const versions = await getVersions(client, workspace);
        return c.json({
            name: nextVersionName(versions.map((version) => version.name))
        });
    }
);

/**
 * Long enough that a row and the card it opens on hover share one fetch, short
 * enough that a workspace somebody just changed looks current again soon. Not
 * one of {@link CachePolicy}'s three: a workspace thumbnail is neither
 * immutable, as a rendered configuration's is, nor unstorable.
 */
const WORKSPACE_THUMBNAIL_CACHE = "private, max-age=300";

/**
 * `GET /api/workspace-thumbnail?documentId=&instanceId=&size=`
 *
 * The linked workspace's own thumbnail, proxied: Onshape serves it only to an
 * OAuth caller, so the browser cannot fetch it directly. Nothing is stored or
 * rendered — this is the picture Onshape already keeps for the document.
 *
 * A workspace with no thumbnail answers 404, which the client shows as the same
 * placeholder any other missing image gets.
 *
 * Requires read on the workspace.
 */
versionManagerRoutes.get(
    "/workspace-thumbnail",
    requireSignInMiddleware,
    validate("query", thumbnailQuery),
    async (c) => {
        const query = c.req.valid("query");
        const workspace = toWorkspace(query);
        const client = await c.var.getOnshapeApi();
        await requirePermissions(
            client,
            workspace,
            "read this document",
            OnshapePermission.READ
        );

        let bytes: ArrayBuffer;
        try {
            bytes = await getWorkspaceThumbnail(client, workspace, query.size);
        } catch (error) {
            // A document Onshape has no picture for, which is an answer rather
            // than a failure: the client falls back to the placeholder.
            console.warn(
                `No thumbnail for ${workspace.documentId}/${workspace.instanceId}`,
                error
            );
            return c.body(null, HttpStatus.NOT_FOUND);
        }

        return new Response(bytes, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": WORKSPACE_THUMBNAIL_CACHE
            }
        });
    }
);
