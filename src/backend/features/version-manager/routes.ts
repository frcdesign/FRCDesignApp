import { HttpStatus } from "http-status-ts";
import { z } from "zod";
import { forbiddenError, handledError } from "../../lib/api-error";
import { cacheMiddleware } from "../../lib/cache";
import { getApp, type AppContext } from "../../lib/context";
import { OnshapeApiError, type OnshapeApi } from "../../lib/onshape/client";
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
import { type Db, getDb } from "../../db/client";
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
    type AddLinkOut,
    type VersionJobDocument,
    type WorkspaceLinksData,
    type WorkspacePath
} from "./contract";
import {
    ancestorKeys,
    childrenOf,
    descendantKeys,
    LinkCycleError,
    parentsOf,
    pullOrder,
    pushOrder,
    type WorkspaceEdge
} from "./graph";
import { getJobStatus, startJob } from "./jobs";
import {
    addLink,
    collectEdges,
    deleteLink,
    getChildLinks,
    getLink,
    getParentLinks,
    otherEnd,
    reverseLink,
    toEdge,
    toLinkedWorkspace
} from "./links";
import { describeWorkspace, forgetWorkspace } from "./workspace-cache";
import { markHintSeen } from "../hints/store";
import { Hint } from "../hints/contract";

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
    z.object({ kind: z.literal(PullScopeKind.ANCESTORS) }),
    z.object({ kind: z.literal(PullScopeKind.ALL) }),
    z.object({
        kind: z.literal(PullScopeKind.ONE),
        workspace: workspaceSchema,
        /** Carries the pull on up through that parent's own ancestors. */
        recursive: z.boolean().default(false)
    })
]);

/** What a push and a pull both take. */
const runBody = z.object({
    workspace: workspaceSchema,
    /** Absent while the form shows its suggestion; the workflow numbers each version from its own document's. */
    name: z.string().min(1).max(MAX_VERSION_NAME_LENGTH).optional(),
    description: z.string().max(10_000).optional(),
    /** Moves references onto versions that exist, cutting none. */
    updateOnly: z.boolean().default(false)
});

const pushBody = runBody.extend({
    scope: pushScope.default({ kind: PushScopeKind.CHILDREN })
});

const pullBody = runBody.extend({
    scope: pullScope.default({ kind: PullScopeKind.PARENTS })
});

type WorkspaceInput = z.infer<typeof workspaceSchema>;

type PushScopeInput = z.infer<typeof pushScope>;
type PullScopeInput = z.infer<typeof pullScope>;

function toWorkspace(input: WorkspaceInput): WorkspacePath {
    return toWorkspacePath(input.documentId, input.instanceId);
}

/** Onshape decides what may be done here: the library's access levels have no say over somebody's documents. */
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

/** What every route that only shows a workspace asks for. */
function requireRead(
    client: OnshapeApi,
    workspace: WorkspacePath
): Promise<void> {
    return requirePermissions(
        client,
        workspace,
        "read this document",
        OnshapePermission.READ
    );
}

/** GET /api/workspace-links?documentId=&instanceId= — the links either side of a workspace. */
versionManagerRoutes.get(
    "/workspace-links",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceSchema),
    async (c) => {
        const workspace = toWorkspace(c.req.valid("query"));
        const client = await c.var.getOnshapeApi();
        await requireRead(client, workspace);

        const db = getDb(c.env.DB);
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

const refreshBody = z.object({ workspace: workspaceSchema });

/** POST /api/workspace-links/refresh — forgets what is cached of the linked documents, for an explicit refresh. */
versionManagerRoutes.post(
    "/workspace-links/refresh",
    requireSignInMiddleware,
    validate("json", refreshBody),
    async (c) => {
        const workspace = toWorkspace(c.req.valid("json").workspace);
        await requireRead(await c.var.getOnshapeApi(), workspace);

        const db = getDb(c.env.DB);
        const rows = (
            await Promise.all([
                getParentLinks(db, workspace),
                getChildLinks(db, workspace)
            ])
        ).flat();
        await Promise.all(
            rows.map((row) =>
                forgetWorkspace(c.env.KV, otherEnd(row, workspace))
            )
        );
        return c.json({ success: true });
    }
);

/** POST /api/workspace-links — a document already linked either way is refused. */
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
        await Promise.all([
            requirePermissions(
                client,
                workspace,
                "edit this document",
                OnshapePermission.WRITE
            ),
            requirePermissions(
                client,
                linked,
                "read the document you linked",
                OnshapePermission.READ
            )
        ]);

        const db = getDb(c.env.DB);
        await refuseLinkedDocument(db, workspace, linked);

        // A parent provides to this workspace; a child takes from it.
        const [parent, child] =
            body.direction === LinkDirection.PARENT
                ? [linked, workspace]
                : [workspace, linked];
        await addLink(db, parent, child);
        await markHintSeen(c, Hint.USED_VERSION_MANAGER);

        const out: AddLinkOut = await describeWorkspace(
            c,
            client,
            linked
        ).catch((error: unknown) => {
            console.warn("Failed to name a new link", error);
            return {};
        });
        return c.json(out);
    }
);

/** Linking the same document twice, as a parent and a child or twice over, is a mistake. */
async function refuseLinkedDocument(
    db: Db,
    workspace: WorkspacePath,
    linked: WorkspacePath
): Promise<void> {
    const [parentRows, childRows] = await Promise.all([
        getParentLinks(db, workspace),
        getChildLinks(db, workspace)
    ]);
    const isLinked = (rows: typeof parentRows) =>
        rows.some(
            (row) => otherEnd(row, workspace).documentId === linked.documentId
        );
    if (isLinked(parentRows) || isLinked(childRows)) {
        throw handledError(
            `That document is already linked as a ${isLinked(parentRows) ? "parent" : "child"}.`,
            HttpStatus.CONFLICT
        );
    }
}

/** DELETE /api/workspace-link/:linkId — needs write on either end, a link being both workspaces'. */
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

/** POST /api/workspace-link/:linkId/move — turns a link around; already that way round is success. */
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
        await Promise.all([
            requirePermissions(
                client,
                workspace,
                "edit this document",
                OnshapePermission.WRITE
            ),
            requirePermissions(
                client,
                linked,
                "read the linked document",
                OnshapePermission.READ
            )
        ]);

        await reverseLink(db, row);
        return c.json({ success: true });
    }
);

/** POST /api/push-version — checks every workspace the run writes to before it starts. */
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
        const run = await c.env.VERSION_MANAGER_WORKFLOW.create({
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
        const status = await startJob(c.env, workspace, run.id, {
            kind: VersionJobKind.PUSH,
            updateOnly,
            targets
        });

        await markHintSeen(c, Hint.USED_VERSION_MANAGER);
        return c.json(status);
    }
);

/** Each workspace's document name, by `workspaceKey`, for the run's status; one Onshape won't give is left out. */
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

/** A version is pinned per document, so versioning one twice would leave everything after it on the last. */
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

/** Whether the pull carries on above the parents it first reaches. */
function isRecursivePull(scope: PullScopeInput): boolean {
    return (
        scope.kind === PullScopeKind.ANCESTORS ||
        (scope.kind === PullScopeKind.ONE && scope.recursive)
    );
}

/** The run's order, or a refusal where the links loop. */
function orderOrRefuse(
    run: "push" | "pull",
    order: () => WorkspacePath[]
): WorkspacePath[] {
    try {
        return order();
    } catch (error) {
        if (error instanceof LinkCycleError) {
            throw handledError(
                `The linked workspaces form a loop, so there is no order to ${run} them in. Remove a link and try again.`,
                HttpStatus.CONFLICT
            );
        }
        throw error;
    }
}

/** The workspaces the push updates, in order, with the edges they came from. */
async function resolvePushOrder(
    c: AppContext,
    workspace: WorkspacePath,
    scope: PushScopeInput
): Promise<{ order: WorkspacePath[]; edges: WorkspaceEdge[] }> {
    const db = getDb(c.env.DB);
    const recursive = isRecursive(scope);
    const edges = recursive
        ? await collectEdges(db, workspace, LinkDirection.CHILD)
        : (await getChildLinks(db, workspace)).map(toEdge);

    let order = orderOrRefuse("push", () =>
        pushOrder(edges, workspace, recursive)
    );

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

/** POST /api/pull-references — checks every parent it versions before it starts. */
versionManagerRoutes.post(
    "/pull-references",
    requireSignInMiddleware,
    validate("json", pullBody),
    async (c) => {
        const body = c.req.valid("json");
        const { name, description = "", scope, updateOnly } = body;
        const workspace = toWorkspace(body.workspace);
        const recursive = isRecursivePull(scope);

        if (updateOnly && recursive) {
            throw handledError(
                "A recursive pull has to version the documents it passes through.",
                HttpStatus.BAD_REQUEST
            );
        }
        const client = await c.var.getOnshapeApi();
        await requireIdle(c, workspace);
        const { sources, edges } = await resolvePullSources(
            c,
            workspace,
            scope
        );
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
        const targets = toDocuments(
            recursive
                ? scope.kind === PullScopeKind.ONE
                    ? [toWorkspace(scope.workspace)]
                    : parentsOf(edges, workspace)
                : (sources ?? []),
            documentNames
        );
        const run = await c.env.VERSION_MANAGER_WORKFLOW.create({
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
                // Those with parents of their own in the run.
                referencing: recursive
                    ? (sources ?? []).filter(
                          (each) => parentsOf(edges, each).length > 0
                      )
                    : undefined,
                name,
                description
            }
        });
        const status = await startJob(c.env, workspace, run.id, {
            kind: VersionJobKind.PULL,
            updateOnly,
            targets
        });

        await markHintSeen(c, Hint.USED_VERSION_MANAGER);
        return c.json(status);
    }
);

/**
 * The parents a pull versions, in order, or undefined for every out-of-date
 * reference; with the edges they came from.
 */
async function resolvePullSources(
    c: AppContext,
    workspace: WorkspacePath,
    scope: PullScopeInput
): Promise<{ sources?: WorkspacePath[]; edges: WorkspaceEdge[] }> {
    if (scope.kind === PullScopeKind.ALL) {
        return { edges: [] };
    }

    const db = getDb(c.env.DB);
    const recursive = isRecursivePull(scope);
    const edges = recursive
        ? await collectEdges(db, workspace, LinkDirection.PARENT)
        : (await getParentLinks(db, workspace)).map(toEdge);
    const parents = parentsOf(edges, workspace);
    const order = () =>
        recursive
            ? orderOrRefuse("pull", () => pullOrder(edges, workspace))
            : parents;

    if (scope.kind === PullScopeKind.ONE) {
        const parent = toWorkspace(scope.workspace);
        if (!parents.some((each) => isSameWorkspace(each, parent))) {
            throw handledError(
                "That workspace is no longer a parent of this one.",
                HttpStatus.CONFLICT
            );
        }
        // Filtered, so a parent fed by two of these still comes after both.
        const kept = ancestorKeys(edges, parent);
        return {
            sources: order().filter((each) => kept.has(workspaceKey(each))),
            edges
        };
    }

    if (parents.length === 0) {
        throw handledError(
            "This workspace has no parents to pull from.",
            HttpStatus.CONFLICT
        );
    }
    return { sources: order(), edges };
}

/** GET /api/version-job?documentId=&instanceId= */
versionManagerRoutes.get(
    "/version-job",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceSchema),
    async (c) => {
        const workspace = toWorkspace(c.req.valid("query"));
        await requireRead(await c.var.getOnshapeApi(), workspace);
        return c.json(await getJobStatus(c.env, workspace));
    }
);

/** GET /api/next-version-name?documentId=&instanceId= — what an unnamed run would call a version here. */
versionManagerRoutes.get(
    "/next-version-name",
    requireSignInMiddleware,
    cacheMiddleware(),
    validate("query", workspaceSchema),
    async (c) => {
        const workspace = toWorkspace(c.req.valid("query"));
        const client = await c.var.getOnshapeApi();
        await requireRead(client, workspace);
        const versions = await getVersions(client, workspace);
        return c.json({
            name: nextVersionName(versions.map((version) => version.name))
        });
    }
);

/** Neither immutable nor unstorable, so none of `CachePolicy`'s: a row and its hover share one fetch. */
const WORKSPACE_THUMBNAIL_CACHE = "private, max-age=300";

/** GET /api/workspace-thumbnail?documentId=&instanceId=&size= — proxied, Onshape serving it only to an OAuth caller. */
versionManagerRoutes.get(
    "/workspace-thumbnail",
    requireSignInMiddleware,
    validate("query", thumbnailQuery),
    async (c) => {
        const query = c.req.valid("query");
        const workspace = toWorkspace(query);
        const client = await c.var.getOnshapeApi();
        await requireRead(client, workspace);

        let bytes: ArrayBuffer;
        try {
            bytes = await getWorkspaceThumbnail(client, workspace, query.size);
        } catch (error) {
            // No picture: the client shows its placeholder.
            if (
                error instanceof OnshapeApiError &&
                error.status === HttpStatus.NOT_FOUND
            ) {
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
