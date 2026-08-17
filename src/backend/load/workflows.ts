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
import type { InstancePath } from "../../shared/onshape-path";
import { group, insertables, libraries } from "../../shared/schema";
import type { ThumbnailParams } from "../../shared/thumbnails";
import { uploadConfigurationThumbnails } from "../routes/thumbnails";
import {
    type GroupTarget,
    type LoadContext,
    LOAD_CONCURRENCY,
    createLimiter,
    getOnshapeApiFromContext
} from "./load-common";
import { untrackJob } from "./job-tracker";
import { loadGroup } from "./load-group";
import { THUMBNAIL_STEP_RETRIES } from "./load-steps";

export interface LoadLibraryParams {
    libraryId: LibraryId;
    sessionId: string;
    forceReload?: boolean;
}

/** The outcome of loading a single group within a run. */
type GroupResult =
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
        const ctx: LoadContext = {
            env: this.env,
            sessionId,
            step,
            limit: createLimiter(LOAD_CONCURRENCY)
        };

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
                    const target = await resolveGroupTarget(
                        ctx,
                        { libraryId, groupId, documentId },
                        `-${groupId}`
                    );
                    if (
                        storedGroup.versionId ===
                            target.versionPath.instanceId &&
                        !forceReload
                    ) {
                        return { groupId, status: "skipped" };
                    }
                    const loaded = await loadGroup(ctx, target, forceReload);
                    return { groupId, status: "reloaded", ...loaded };
                } catch {
                    return { groupId, status: "failed" };
                }
            })
        );

        await step.do("finalize", () => finalizeLibrary(ctx.env, libraryId));
        await step.do("untrack-job", () =>
            untrackJob(ctx.env, libraryId, event.instanceId)
        );

        return results;
    }
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
            step,
            limit: createLimiter(LOAD_CONCURRENCY)
        };

        let result: GroupResult;
        try {
            const target = await resolveGroupTarget(ctx, params, "");

            await step.do("create-shell-group", () =>
                createShellGroup(ctx.env, params, target.name)
            );

            const loaded = await loadGroup(ctx, target, false);
            result = { groupId: params.groupId, status: "created", ...loaded };
        } catch {
            result = { groupId: params.groupId, status: "failed" };
        }

        await step.do("finalize", () =>
            finalizeLibrary(ctx.env, params.libraryId)
        );
        await step.do("untrack-job", () =>
            untrackJob(ctx.env, params.libraryId, event.instanceId)
        );
        return result;
    }
}

/** Reads the document and its latest version, pinning the group to that version. */
async function resolveGroupTarget(
    ctx: LoadContext,
    ids: { libraryId: LibraryId; groupId: string; documentId: string },
    stepSuffix: string
): Promise<GroupTarget> {
    const { documentId } = ids;
    const document = await ctx.step.do(`document${stepSuffix}`, async () =>
        getDocument(await getOnshapeApiFromContext(ctx), { documentId })
    );
    const versionId = await ctx.step.do(`version${stepSuffix}`, async () =>
        getLatestVersionId(await getOnshapeApiFromContext(ctx), { documentId })
    );

    const versionPath: InstancePath = {
        documentId,
        instanceId: versionId,
        instanceType: "v"
    };
    return {
        libraryId: ids.libraryId,
        groupId: ids.groupId,
        versionPath,
        name: document.name,
        thumbnailElementId: document.documentThumbnailElementId
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
    await rebuildSearchDb(env.BLOB, db, libraryId);
    await bumpLibraryVersion(db, libraryId);
}

/** The render to run, plus the session whose Onshape tokens it runs under. */
export interface ThumbnailWorkflowParams extends ThumbnailParams {
    sessionId: string;
}

/**
 * Outside a request, since Onshape can take minutes. Until it finishes,
 * requests fall back to the element's default thumbnail.
 */
export class ThumbnailWorkflow extends WorkflowEntrypoint<
    AppBindings,
    ThumbnailWorkflowParams
> {
    async run(
        event: WorkflowEvent<ThumbnailWorkflowParams>,
        step: WorkflowStep
    ): Promise<void> {
        const { elementId, microversionId, canonicalConfiguration, sessionId } =
            event.payload;

        const elementPath = await step.do("resolve-element", async () => {
            const row = await getDb(this.env.DB)
                .select({
                    documentId: insertables.documentId,
                    versionId: insertables.versionId
                })
                .from(insertables)
                .where(eq(insertables.elementId, elementId))
                .get();
            if (!row) {
                throw new Error(`No insertable for element ${elementId}`);
            }
            return {
                documentId: row.documentId,
                instanceId: row.versionId,
                instanceType: "v" as const,
                elementId
            };
        });

        await step.do(
            "render-thumbnails",
            { retries: THUMBNAIL_STEP_RETRIES },
            async () =>
                uploadConfigurationThumbnails(
                    this.env.BLOB,
                    await getOnshapeApiFromContext({
                        env: this.env,
                        sessionId,
                        step,
                        limit: createLimiter(1)
                    }),
                    elementPath,
                    microversionId,
                    canonicalConfiguration
                )
        );
    }
}
