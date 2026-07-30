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
import { group, libraries } from "../../shared/schema";
import { type LoadContext, getOnshapeApiFromContext } from "./load-utils";
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

        const groups = await step.do("list-groups", async () => {
            const db = getDb(this.env.DB);
            return await db
                .select({
                    groupId: group.id,
                    documentId: group.documentId,
                    versionId: group.versionId
                })
                .from(group)
                .where(eq(group.libraryId, libraryId));
        });

        const results = await Promise.all(
            groups.map(async (group): Promise<GroupResult> => {
                const { groupId, documentId } = group;
                try {
                    const document = await step.do(
                        `document-${groupId}`,
                        async () => {
                            const onshapeApi =
                                await getOnshapeApiFromContext(ctx);
                            return getDocument(onshapeApi, { documentId });
                        }
                    );
                    const versionId = await step.do(
                        `version-${groupId}`,
                        async () => {
                            const onshapeApi =
                                await getOnshapeApiFromContext(ctx);
                            return getLatestVersionId(onshapeApi, {
                                documentId
                            });
                        }
                    );
                    if (group.versionId === versionId && !forceReload) {
                        return { groupId, status: "skipped" };
                    }
                    const loaded = await loadGroup(
                        ctx,
                        {
                            libraryId,
                            groupId,
                            versionPath: {
                                documentId,
                                instanceId: versionId,
                                instanceType: "v"
                            }
                        },
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
            const document = await step.do("document", async () => {
                const onshapeApi = await getOnshapeApiFromContext(ctx);
                return getDocument(onshapeApi, {
                    documentId: params.documentId
                });
            });
            const versionId = await step.do("version", async () => {
                const onshapeApi = await getOnshapeApiFromContext(ctx);
                return getLatestVersionId(onshapeApi, {
                    documentId: params.documentId
                });
            });

            await step.do("create-shell-group", () =>
                this.createShellGroup(params, document.name)
            );

            const loaded = await loadGroup(
                ctx,
                {
                    libraryId: params.libraryId,
                    groupId: params.groupId,
                    versionPath: {
                        documentId: params.documentId,
                        instanceId: versionId,
                        instanceType: "v"
                    }
                },
                document,
                false
            );
            result = { groupId: params.groupId, status: "created", ...loaded };
        } catch {
            result = { groupId: params.groupId, status: "failed" };
        }

        await step.do("finalize", () =>
            finalizeLibrary(ctx.env, params.libraryId)
        );
        return result;
    }

    /**
     * Writes the group row the load then fills in, creating the library if this
     * is its first group.
     */
    private async createShellGroup(
        params: AddGroupParams,
        groupName: string
    ): Promise<void> {
        const db = getDb(this.env.DB);
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
