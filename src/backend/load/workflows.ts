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
import { group, libraries } from "../../shared/schema";
import { type LoadContext, getOnshapeApiFromLoadContext } from "./load-utils";
import { loadGroup } from "./load-group";

export interface LoadLibraryParams {
    libraryId: LibraryId;
    sessionId: string;
    forceReload?: boolean;
}

export interface AddGroupParams {
    /** The new group's id, minted by the route. */
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    sessionId: string;
    /** An existing group to place the new group after. */
    selectedGroupId?: string;
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
        const { libraryId, sessionId } = event.payload;
        const forceReload = event.payload.forceReload ?? false;
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
                                await getOnshapeApiFromLoadContext(ctx);
                            return getDocument(onshapeApi, { documentId });
                        }
                    );
                    if (
                        group.versionId === document.recentVersion.id &&
                        !forceReload
                    ) {
                        return { groupId, status: "skipped" };
                    }
                    const loaded = await loadGroup(
                        ctx,
                        libraryId,
                        groupId,
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
                const onshapeApi = await getOnshapeApiFromLoadContext(ctx);
                return getDocument(onshapeApi, {
                    documentId: params.documentId
                });
            });

            await step.do("create-shell", () =>
                this.createShell(params, document.name)
            );

            const loaded = await loadGroup(
                ctx,
                params.libraryId,
                params.groupId,
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

    private async createShell(
        params: AddGroupParams,
        docName: string
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
                name: docName,
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
