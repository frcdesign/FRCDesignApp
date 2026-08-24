import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import type { LibraryId } from "../library/library-id";
import {
    bumpLibraryVersion,
    placeNewGroup,
    rebuildSearchDb
} from "../library/db";
import { getDocument } from "../../lib/onshape/endpoints/documents";
import { getLatestVersionId } from "../../lib/onshape/endpoints/versions";
import type { InstancePath } from "../../lib/onshape/path";
import { group, libraries, PLACEHOLDER_VERSION_ID } from "../../db/schema";
import { addBuildIssue, BuildIssueType } from "../build-checker/issues";

import {
    type GroupTarget,
    type LoadContext,
    LOAD_CONCURRENCY,
    createLimiter,
    getOnshapeApiFromContext
} from "./context";
import { untrackJob } from "./job-tracker";
import { loadGroup } from "./load-group";

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
                    await ctx.step.do(`flag-failed-${groupId}`, () =>
                        flagFailedGroup(ctx.env, groupId)
                    );
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
    /** The document's name, already fetched by the route. */
    documentName: string;
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

        // Written before anything can fail, so an add that dies partway leaves a
        // group the library still shows and an editor can retry or delete.
        await step.do("create-shell-group", () =>
            createShellGroup(ctx.env, params)
        );

        let result: GroupResult;
        try {
            const target = await resolveGroupTarget(ctx, params, "");
            const loaded = await loadGroup(ctx, target, false);
            result = { groupId: params.groupId, status: "created", ...loaded };
        } catch {
            await step.do("flag-failed-group", () =>
                flagFailedGroup(ctx.env, params.groupId)
            );
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
    params: AddGroupParams
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
            name: params.documentName,
            versionId: PLACEHOLDER_VERSION_ID,
            sortOrder
        })
        .onConflictDoNothing();
}

/**
 * Records the failure on the group row, so the library flags it instead of
 * showing an empty group with nothing to explain it. A later successful load
 * recomputes `buildIssues` from scratch and clears it.
 */
async function flagFailedGroup(
    env: AppBindings,
    groupId: string
): Promise<void> {
    const db = getDb(env.DB);
    const row = await db
        .select({ buildIssues: group.buildIssues })
        .from(group)
        .where(eq(group.id, groupId))
        .get();
    if (!row) {
        return;
    }
    await db
        .update(group)
        .set({
            buildIssues: addBuildIssue(row.buildIssues, {
                type: BuildIssueType.LOAD_FAILED
            })
        })
        .where(eq(group.id, groupId));
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
