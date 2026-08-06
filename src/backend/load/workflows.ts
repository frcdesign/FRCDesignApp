import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getDb } from "../db";
import type { LibraryId } from "../../shared/types";
import type {
    GroupResult,
    LibraryJobStatus
} from "../../shared/library-job-models";
import { finishLibraryJob } from "../library-jobs";
import {
    bumpLibraryVersion,
    placeNewGroup,
    rebuildSearchDb
} from "../library-data";
import { getDocument } from "../onshape-api/endpoints/documents";
import { getLatestVersionId } from "../onshape-api/endpoints/versions";
import type { InstancePath } from "../../shared/onshape-path";
import { group, libraries } from "../../shared/schema";
import {
    type GroupTarget,
    type LoadContext,
    getOnshapeApiFromContext
} from "./load-context";
import { loadGroup } from "./load-group";

export interface LoadLibraryParams {
    libraryId: LibraryId;
    sessionId: string;
    /** The library-job row this run reports its outcome to. */
    libraryJobId: string;
    forceReload?: boolean;
}

/** Reads a caught value's message for storing on a failed group/job. */
function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/**
 * Derives a load-library job's overall status from its per-group results:
 * `errored` if every non-skipped group failed, `partial` if some failed while
 * others succeeded, `complete` if none failed.
 */
function deriveLoadStatus(results: GroupResult[]): {
    status: LibraryJobStatus;
    error: string | null;
} {
    const failed = results.filter((r) => r.status === "failed").length;
    const succeeded = results.filter(
        (r) => r.status === "created" || r.status === "reloaded"
    ).length;
    if (failed === 0) return { status: "complete", error: null };
    if (succeeded === 0) {
        return { status: "errored", error: `All ${failed} groups failed` };
    }
    return {
        status: "partial",
        error: `${failed} of ${results.length} groups failed`
    };
}

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
        const {
            libraryId,
            sessionId,
            libraryJobId,
            forceReload = false
        } = event.payload;
        const ctx: LoadContext = { env: this.env, sessionId, step };

        try {
            const storedGroups = await step.do("list-groups", () =>
                getDb(ctx.env.DB)
                    .select({
                        groupId: group.id,
                        name: group.name,
                        documentId: group.documentId,
                        versionId: group.versionId
                    })
                    .from(group)
                    .where(eq(group.libraryId, libraryId))
            );

            const results = await Promise.all(
                storedGroups.map(async (storedGroup): Promise<GroupResult> => {
                    const { groupId, name, documentId } = storedGroup;
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
                            return { groupId, name, status: "skipped" };
                        }
                        const loaded = await loadGroup(
                            ctx,
                            target,
                            forceReload
                        );
                        return { groupId, name, status: "reloaded", ...loaded };
                    } catch (e) {
                        // Per-group failures are isolated so one bad document
                        // doesn't sink the whole run; the cause is surfaced on
                        // the job's result for the admin UI.
                        return {
                            groupId,
                            name,
                            status: "failed",
                            error: errorMessage(e)
                        };
                    }
                })
            );

            await step.do("finalize", () =>
                finalizeLibrary(ctx.env, libraryId)
            );

            const { status, error } = deriveLoadStatus(results);
            await step.do("record-library-job", () =>
                finishLibraryJob(getDb(ctx.env.DB), libraryJobId, {
                    status,
                    result: results,
                    error
                })
            );

            return results;
        } catch (e) {
            const error = errorMessage(e);
            await step.do("record-library-job-error", () =>
                finishLibraryJob(getDb(ctx.env.DB), libraryJobId, {
                    status: "errored",
                    result: null,
                    error
                })
            );
            throw e;
        }
    }
}

export interface AddGroupParams {
    /** The new group's id, minted by the route. */
    groupId: string;
    documentId: string;
    libraryId: LibraryId;
    sessionId: string;
    /** The library-job row this run reports its outcome to. */
    libraryJobId: string;
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

        try {
            let result: GroupResult;
            let status: LibraryJobStatus;
            let error: string | null;
            try {
                const target = await resolveGroupTarget(ctx, params, "");

                await step.do("create-shell-group", () =>
                    createShellGroup(ctx.env, params, target.name)
                );

                const loaded = await loadGroup(ctx, target, false);
                result = {
                    groupId: params.groupId,
                    name: target.name,
                    status: "created",
                    ...loaded
                };
                status = "complete";
                error = null;
            } catch (e) {
                error = errorMessage(e);
                result = { groupId: params.groupId, status: "failed", error };
                status = "errored";
            }

            await step.do("finalize", () =>
                finalizeLibrary(ctx.env, params.libraryId)
            );
            await step.do("record-library-job", () =>
                finishLibraryJob(getDb(ctx.env.DB), params.libraryJobId, {
                    status,
                    result,
                    error
                })
            );
            return result;
        } catch (e) {
            const error = errorMessage(e);
            await step.do("record-library-job-error", () =>
                finishLibraryJob(getDb(ctx.env.DB), params.libraryJobId, {
                    status: "errored",
                    result: null,
                    error
                })
            );
            throw e;
        }
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
    await rebuildSearchDb(db, libraryId);
    await bumpLibraryVersion(db, libraryId);
}
