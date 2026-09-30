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
import { getDocument } from "../../lib/onshape/endpoints/documents";
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
    VersionJobKind,
    VersionJobState,
    workspaceKey,
    type VersionJobDocument,
    type WorkspaceLinksData,
    type WorkspacePath
} from "./contract";
import {
    childrenOf,
    descendantKeys,
    LinkCycleError,
    pushOrder,
    type WorkspaceEdge
} from "./graph";
import { getJobStatus, startJob } from "./jobs";
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
import { onshapeStatus } from "./failures";
import { describeWorkspace } from "./workspace-cache";

export const versionManagerRoutes = getApp();

/** Fixed to a workspace: a version has no references to update. */
const workspaceSchema = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1)
});

const thumbnailQuery = workspaceSchema.extend({
    /** Which of Onshape's two stored sizes to serve. */
    size: z.enum(ThumbnailSize).default(ThumbnailSize.SMALL)
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
    scope: pushScope.default({ kind: PushScopeKind.CHILDREN }),
    /** Moves the children onto this document's newest version, cutting none. */
    updateOnly: z.boolean().default(false)
});

const pullBody = z.object({
    workspace: workspaceSchema,
    /** Absent for a quick pull; the workflow names it as Onshape would. */
    name: z.string().min(1).max(MAX_VERSION_NAME_LENGTH).optional(),
    description: z.string().max(10_000).optional(),
    scope: pullScope.default({ kind: PullScopeKind.PARENTS }),
    /** Moves onto the parents' newest versions, cutting none. */
    updateOnly: z.boolean().default(false)
});

type WorkspaceInput = z.infer<typeof workspaceSchema>;

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
 * parents it pulls from and the children it pushes to, and the workspace's own
 * document name. Each link is resolved against Onshape for its names and the
 * caller's permissions, so a link to something they cannot read comes back
 * unopenable and unnamed; a parent also carries what it has changed since its
 * own last version, which is what a pull would leave behind.
 *
 * Requires read on the workspace being asked about.
 */
versionManagerRoutes.get(
    "/workspace-links",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceSchema),
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
        // The caller has read on the workspace, so Onshape describing it is
        // taken for granted: a failure here is unexpected and says so.
        const [parentRows, childRows, document] = await Promise.all([
            getParentLinks(db, workspace),
            getChildLinks(db, workspace),
            getDocument(client, workspace)
        ]);

        const describe = (rows: typeof parentRows, countChanges: boolean) =>
            Promise.all(
                rows.map((row) =>
                    toLinkedWorkspace(
                        c,
                        client,
                        row.id,
                        otherEnd(row, workspace),
                        countChanges
                    )
                )
            );
        const [parents, children] = await Promise.all([
            describe(parentRows, true),
            describe(childRows, false)
        ]);

        const out: WorkspaceLinksData = {
            parents,
            children,
            documentName: document.name
        };
        return c.json(out);
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
        if (!row) return c.json({ success: true });

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
 * own dialog would. Answers the run's first status; the work itself happens in
 * {@link VersionManagerWorkflow}. `updateOnly`
 * cuts nothing, moving the children onto this document's newest version.
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
        const { name, description = "", scope, updateOnly } = body;
        const workspace = toWorkspace(body.workspace);
        const recursive = isRecursive(scope);
        const client = await c.var.getOnshapeApi();

        if (updateOnly && recursive) {
            throw handledError(
                "A recursive push has to version the documents it passes through.",
                HttpStatus.BAD_REQUEST
            );
        }
        await requireIdle(c, workspace);
        const { order, edges } = await resolvePushOrder(c, workspace, scope);
        if (recursive) {
            requireDistinctDocuments([workspace, ...order]);
        }

        await Promise.all([
            ...(updateOnly
                ? []
                : [
                      requirePermissions(
                          client,
                          workspace,
                          "create a version in this document",
                          OnshapePermission.WRITE,
                          OnshapePermission.LINK
                      )
                  ]),
            ...order.map((each) =>
                requirePermissions(
                    client,
                    each,
                    "update every linked document this push would write to",
                    OnshapePermission.WRITE,
                    // What the run versions is what the workspaces past it
                    // come to reference.
                    ...(recursive ? [OnshapePermission.LINK] : [])
                )
            )
        ]);

        const documentNames = await nameDocuments(c, client, [
            workspace,
            ...order
        ]);
        const targets = toDocuments(
            scope.kind === PushScopeKind.ONE
                ? [toWorkspace(scope.workspace)]
                : childrenOf(edges, workspace),
            documentNames
        );
        const instance = await c.env.VERSION_MANAGER_WORKFLOW.create({
            params: {
                kind: VersionJobKind.PUSH,
                sessionId: getSessionId(c),
                userId: await c.var.getUserId(),
                workspace,
                scope: scope.kind,
                updateOnly,
                targets,
                documentNames,
                name,
                description,
                steps: order,
                recursive
            }
        });
        const status = await startJob(c.env, workspace, instance.id, {
            kind: VersionJobKind.PUSH,
            updateOnly,
            targets
        });

        return c.json(status);
    }
);

/**
 * Every workspace's document name, by `workspaceKey`, for the run's status to
 * show. From the cache the rows are named from; a name Onshape will not give is
 * left out.
 */
async function nameDocuments(
    c: AppContext,
    client: OnshapeApi,
    workspaces: WorkspacePath[]
): Promise<Record<string, string>> {
    const names = await Promise.all(
        workspaces.map((each) =>
            describeWorkspace(c, client, each)
                .then((description) => description.documentName)
                .catch(() => undefined)
        )
    );
    return Object.fromEntries(
        workspaces.flatMap((each, index) => {
            const name = names[index];
            return name ? [[workspaceKey(each), name]] : [];
        })
    );
}

function toDocuments(
    workspaces: WorkspacePath[],
    documentNames: Record<string, string>
): VersionJobDocument[] {
    return workspaces.map((each) => ({
        workspace: each,
        documentName: documentNames[workspaceKey(each)]
    }));
}

/** Refuses a second run while one from this workspace is still going. */
async function requireIdle(
    c: AppContext,
    workspace: WorkspacePath
): Promise<void> {
    const current = await getJobStatus(c.env, workspace);
    if (current.state === VersionJobState.RUNNING) {
        throw handledError(
            "A push or pull from this document is still running.",
            HttpStatus.CONFLICT
        );
    }
}

/**
 * A version is pinned per document, so one document versioned twice would
 * leave everything after it on whichever was cut last.
 */
function requireDistinctDocuments(workspaces: WorkspacePath[]): void {
    const documentIds = workspaces.map((each) => each.documentId);
    if (new Set(documentIds).size !== documentIds.length) {
        throw handledError(
            "This would version two workspaces of the same document. Run them one at a time.",
            HttpStatus.CONFLICT
        );
    }
}

/** Whether the push carries on past the workspaces it first reaches. */
function isRecursive(scope: PushScopeInput): boolean {
    return (
        scope.kind === PushScopeKind.DESCENDANTS ||
        (scope.kind === PushScopeKind.ONE && scope.recursive)
    );
}

/**
 * The workspaces the push has to update, in order, and the edges they came
 * from, with the two ways the graph can refuse turned into something the caller
 * can act on.
 */
async function resolvePushOrder(
    c: AppContext,
    workspace: WorkspacePath,
    scope: PushScopeInput
): Promise<{ order: WorkspacePath[]; edges: WorkspaceEdge[] }> {
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
        // Only a linked workspace may be written to.
        const target = toWorkspace(scope.workspace);
        if (!order.some((each) => isSameWorkspace(each, target))) {
            throw handledError(
                "That workspace is no longer a child of this one.",
                HttpStatus.CONFLICT
            );
        }
        // Filtered, so a workspace fed by two of these still comes after both.
        const kept = descendantKeys(edges, target);
        order = order.filter((each) => kept.has(workspaceKey(each)));
    }
    return { order, edges };
}

/**
 * `POST /api/pull-references`
 *
 * Starts a pull: versions each parent {@link PullScope} names — one of them or
 * all of them — and moves this workspace's references onto what was cut. A
 * reference points at a version, so a parent's unversioned edits are only
 * pullable once there is one holding them. Answers the run's first status.
 *
 * `updateOnly` versions nothing either, moving onto whatever versions the
 * parents already have; so does every-reference scope, whose documents are not
 * linked here and are nobody's to cut a version in.
 *
 * Requires write on the caller's workspace, and write and link on each parent
 * it would version. Checked before the run starts, as a push's are.
 */
versionManagerRoutes.post(
    "/pull-references",
    requireSignInMiddleware,
    validate("json", pullBody),
    async (c) => {
        const body = c.req.valid("json");
        const { name, description = "", scope, updateOnly } = body;
        const workspace = toWorkspace(body.workspace);

        const client = await c.var.getOnshapeApi();
        await requireIdle(c, workspace);
        const sources = await resolvePullSources(c, workspace, scope);
        if (sources && !updateOnly) {
            requireDistinctDocuments(sources);
        }

        await Promise.all([
            requirePermissions(
                client,
                workspace,
                "edit this document",
                OnshapePermission.WRITE
            ),
            ...(sources ?? []).map((source) =>
                updateOnly
                    ? requirePermissions(
                          client,
                          source,
                          "read every document this pull reads",
                          OnshapePermission.READ
                      )
                    : requirePermissions(
                          client,
                          source,
                          "create a version in every document this pull reads",
                          OnshapePermission.WRITE,
                          // The reference this workspace ends up carrying
                          // points at it.
                          OnshapePermission.LINK
                      )
            )
        ]);

        const documentNames = await nameDocuments(c, client, [
            workspace,
            ...(sources ?? [])
        ]);
        const targets = toDocuments(sources ?? [], documentNames);
        const instance = await c.env.VERSION_MANAGER_WORKFLOW.create({
            params: {
                kind: VersionJobKind.PULL,
                sessionId: getSessionId(c),
                userId: await c.var.getUserId(),
                workspace,
                scope: scope.kind,
                updateOnly,
                targets,
                documentNames,
                sources,
                name,
                description
            }
        });
        const status = await startJob(c.env, workspace, instance.id, {
            kind: VersionJobKind.PULL,
            updateOnly,
            targets
        });

        return c.json(status);
    }
);

/**
 * The parents a pull versions and takes those versions from, or undefined for
 * every out-of-date reference. Narrowed to the parents, so a pull only moves
 * references the graph accounts for.
 */
async function resolvePullSources(
    c: AppContext,
    workspace: WorkspacePath,
    scope: PullScopeInput
): Promise<WorkspacePath[] | undefined> {
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
        return [toEdge(row).parent];
    }

    if (rows.length === 0) {
        throw handledError(
            "This workspace has no parents to pull from.",
            HttpStatus.CONFLICT
        );
    }
    return rows.map((row) => toEdge(row).parent);
}

/**
 * `GET /api/version-job?documentId=&instanceId=`
 *
 * The push or pull this workspace last started, as {@link VersionJobStatus}:
 * how it is going, or what it did. Requires read on the workspace.
 */
versionManagerRoutes.get(
    "/version-job",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceSchema),
    async (c) => {
        const workspace = toWorkspace(c.req.valid("query"));
        await requirePermissions(
            await c.var.getOnshapeApi(),
            workspace,
            "read this document",
            OnshapePermission.READ
        );
        return c.json(await getJobStatus(c.env, workspace));
    }
);

/**
 * `GET /api/next-version-name?documentId=&instanceId=`
 *
 * What a run with no name of its own would call a version it cuts here: `V<n>`
 * after the highest the document carries, as Onshape's own dialog offers.
 *
 * Requires read on the workspace.
 */
versionManagerRoutes.get(
    "/next-version-name",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceSchema),
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
            // A document Onshape has no picture for: the client shows the
            // placeholder.
            if (onshapeStatus(error) === HttpStatus.NOT_FOUND) {
                return c.body(null, HttpStatus.NOT_FOUND);
            }
            throw error;
        }

        return new Response(bytes, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": WORKSPACE_THUMBNAIL_CACHE
            }
        });
    }
);
