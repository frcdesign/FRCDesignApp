import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getDb } from "../db";
import type { LibraryId } from "../../shared/types";
import {
    bumpLibraryVersion,
    placeNewGroup,
    rebuildSearchDb
} from "../library-data";
import { getDocument } from "../onshape-api/endpoints/documents";
import { getLatestVersionId } from "../onshape-api/endpoints/versions";
import type { OnshapeDocumentInfo } from "../onshape-api/onshape-types";
import { group, libraries } from "../../shared/schema";
import {
    type GroupTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./load-context";
import { loadGroup } from "./load-group";

/**
 * Workflow parameters must be JSON-serializable, so these carry a `sessionId`
 * rather than an `OnshapeApi`: the client is a class instance holding a token
 * refresh callback, which cannot be serialized. Each step rebuilds it from the
 * session (see `getOnshapeApi`), which also picks up a token
 * refreshed while the instance was sleeping or retrying.
 */
export interface LoadLibraryParams {
    libraryId: LibraryId;
    sessionId: string;
    forceReload?: boolean;
}

export type GroupResult =
    | { groupId: string; status: "skipped" | "failed" }
    | {
          groupId: string;
          status: "created" | "reloaded";
          loadedElements: number;
          deletedElements: number;
          failedElements: number;
      };

/**
 * Reloads every group in a library whose document has a new version (or all of
 * them, on forceReload), then rebuilds the search index once at the end.
 */
export class LoadLibraryWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadLibraryParams
> {
    async run(
        event: WorkflowEvent<LoadLibraryParams>,
        step: WorkflowStep
    ): Promise<GroupResult[]> {
        const { libraryId, sessionId, forceReload = false } = event.payload;
        const ctx: LoadContext = { env: this.env, sessionId, step };

        const storedGroups = await step.do("list-groups", () =>
            getDb(ctx.env.DB)
                .select({
                    groupId: group.id,
                    documentId: group.documentId,
                    versionId: group.versionId
                })
                .from(group)
                .where(eq(group.libraryId, libraryId))
        );

        const results = await Promise.all(
            storedGroups.map(async (storedGroup): Promise<GroupResult> => {
                const { groupId, documentId } = storedGroup;
                try {
                    const { document, target } = await resolveGroupTarget(
                        ctx,
                        { libraryId, groupId, documentId },
                        `document-${groupId}`
                    );
                    if (
                        storedGroup.versionId ===
                            target.versionPath.instanceId &&
                        !forceReload
                    ) {
                        return { groupId, status: "skipped" };
                    }
                    const loaded = await loadGroup(
                        ctx,
                        target,
                        document,
                        forceReload
                    );
                    return { groupId, status: "reloaded", ...loaded };
                } catch {
                    return { groupId, status: "failed" };
                }
            })
        );

        await step.do("finalize", () => finalizeLibrary(ctx.env, libraryId));

        return results;
    }
}

/** See {@link LoadLibraryParams} for why this carries a `sessionId`. */
export interface AddGroupParams {
    /** The new group's id, minted by the route. */
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    sessionId: string;
    /** An existing group to place the new group after. */
    selectedGroupId?: string;
}

/**
 * Adds an Onshape document to a library by inserting and then loading it.
 */
export class AddGroupWorkflow extends WorkflowEntrypoint<
    AppBindings,
    AddGroupParams
> {
    async run(
        event: WorkflowEvent<AddGroupParams>,
        step: WorkflowStep
    ): Promise<GroupResult> {
        const params = event.payload;
        const ctx: LoadContext = {
            env: this.env,
            sessionId: params.sessionId,
            step
        };

        let result: GroupResult;
        try {
            const { document, target } = await resolveGroupTarget(
                ctx,
                params,
                "document"
            );

            await step.do("create-shell-group", () =>
                createShellGroup(ctx.env, params, document.name)
            );

            const loaded = await loadGroup(ctx, target, document, false);
            result = { groupId: params.groupId, status: "created", ...loaded };
        } catch {
            result = { groupId: params.groupId, status: "failed" };
        }

        await step.do("finalize", () =>
            finalizeLibrary(ctx.env, params.libraryId)
        );
        return result;
    }
}

/**
 * Reads the document and its latest version, pinning the group to that version.
 *
 * Both are cheap reads on the same document, so they share one step: a retry
 * costs two extra GETs and saves a step per group.
 */
async function resolveGroupTarget(
    ctx: LoadContext,
    ids: { libraryId: LibraryId; groupId: string; documentId: string },
    stepName: string
): Promise<{ document: OnshapeDocumentInfo; target: GroupTarget }> {
    const { documentId } = ids;
    const { document, versionId } = await ctx.step.do(stepName, async () => {
        const onshapeApi = await getOnshapeApiFromContext(ctx);
        return {
            document: await getDocument(onshapeApi, { documentId }),
            versionId: await getLatestVersionId(onshapeApi, { documentId })
        };
    });

    return {
        document,
        target: {
            libraryId: ids.libraryId,
            groupId: ids.groupId,
            versionPath: {
                documentId,
                instanceId: versionId,
                instanceType: "v"
            }
        }
    };
}

/**
 * Writes the group row the load then fills in, creating the library if this is
 * its first group.
 */
async function createShellGroup(
    env: AppBindings,
    params: AddGroupParams,
    groupName: string
): Promise<void> {
    const db = getDb(env.DB);
    await db
        .insert(libraries)
        .values({ id: params.libraryId })
        .onConflictDoNothing();
    // placeNewGroup renumbers siblings eagerly. Failed inserts result in a gap that's fixed on the next edit.
    const sortOrder = await placeNewGroup(
        db,
        params.libraryId,
        params.selectedGroupId
    );
    await db
        .insert(group)
        .values({
            id: params.groupId,
            documentId: params.documentId,
            libraryId: params.libraryId,
            name: groupName,
            // Placeholder value so failed loads can be retried
            versionId: "placeholder",
            sortOrder
        })
        .onConflictDoNothing();
}

/** Rebuild the library's search index and bump its cache version. */
async function finalizeLibrary(
    env: AppBindings,
    libraryId: LibraryId
): Promise<void> {
    const db = getDb(env.DB);
    await rebuildSearchDb(db, libraryId);
    await bumpLibraryVersion(db, libraryId);
}
