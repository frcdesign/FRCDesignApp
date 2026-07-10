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
import type { OnshapeDocumentInfo } from "../onshape-api/onshape-types";
import { group, libraries } from "../../shared/schema";
import { DATA_RETRIES, type LoadDeps, api } from "./load-insertable";
import { loadGroup, mapLimit, shouldSkipGroup } from "./load-group";

const GROUP_CONCURRENCY = 4;

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
        const deps: LoadDeps = { env: this.env, sessionId };

        const groups = await step.do("plan", async () => {
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

        const results = await mapLimit(
            groups,
            GROUP_CONCURRENCY,
            async (stored): Promise<GroupResult> => {
                const { groupId } = stored;
                try {
                    const document = await step.do(
                        `document-${groupId}`,
                        DATA_RETRIES,
                        () => fetchDocumentInfo(deps, stored.documentId)
                    );
                    if (
                        shouldSkipGroup(
                            stored.versionId,
                            document.recentVersion.id,
                            forceReload
                        )
                    ) {
                        return { groupId, status: "skipped" };
                    }
                    const loaded = await loadGroup(deps, step, {
                        groupId,
                        forceReload,
                        document
                    });
                    return { groupId, status: "reloaded", ...loaded };
                } catch {
                    return { groupId, status: "failed" };
                }
            }
        );

        await step.do("finalize", () => finalizeLibrary(this.env, libraryId));

        return results;
    }
}

/**
 * Adds an Onshape document to a library: inserts a shell group row (owning its
 * placement), then loads it. The shell's placeholder versionId means a failed
 * or interrupted add is retried by the next library sync rather than skipped.
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
        const deps: LoadDeps = { env: this.env, sessionId: params.sessionId };

        let result: GroupResult;
        try {
            const document = await step.do("document", DATA_RETRIES, () =>
                fetchDocumentInfo(deps, params.documentId)
            );

            await step.do("create-shell", () =>
                this.createShell(params, document.name)
            );

            const loaded = await loadGroup(deps, step, {
                groupId: params.groupId,
                forceReload: false,
                document
            });
            result = { groupId: params.groupId, status: "created", ...loaded };
        } catch {
            result = { groupId: params.groupId, status: "failed" };
        }

        await step.do("finalize", () =>
            finalizeLibrary(this.env, params.libraryId)
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
        // placeNewGroup may renumber siblings eagerly, before the insert. If
        // the insert then fails, the worst case is a harmless sortOrder gap
        // the retry re-derives.
        const sortOrder = await placeNewGroup(
            db,
            params.libraryId,
            params.groupId,
            params.selectedGroupId
        );
        await db
            .insert(group)
            .values({
                id: params.groupId,
                documentId: params.documentId,
                libraryId: params.libraryId,
                name: docName,
                // Placeholder — never matches a real version, so loadGroup
                // claims the versionId only once the group is fully loaded.
                versionId: "",
                sortOrder
            })
            // A replay after a committed insert converges instead of failing.
            .onConflictDoNothing();
    }
}

/**
 * getDocument, trimmed to the fields the pipeline reads — the full document
 * JSON is large, and step outputs are persisted.
 */
async function fetchDocumentInfo(
    deps: LoadDeps,
    documentId: string
): Promise<OnshapeDocumentInfo> {
    const doc = await getDocument(await api(deps), { documentId });
    return {
        name: doc.name,
        documentThumbnailElementId: doc.documentThumbnailElementId,
        recentVersion: {
            id: doc.recentVersion.id,
            name: doc.recentVersion.name
        }
    };
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
