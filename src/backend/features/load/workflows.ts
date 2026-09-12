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
    ensureLibrary,
    placeNewGroup,
    rebuildSearchDb
} from "../library/db";
import { getDocument } from "../../lib/onshape/endpoints/documents";
import { getLatestVersionId } from "../../lib/onshape/endpoints/versions";
import type { InstancePath } from "../../lib/onshape/path";
import { groups, PLACEHOLDER_VERSION_ID } from "../../db/schema";
import { addBuildIssue, BuildIssueType } from "../build-checker/issues";

import {
    type GroupTarget,
    type LoadContext,
    createLoadContext,
    getOnshapeApiFromContext
} from "./context";
import { untrackJob } from "./job-tracker";
import { loadGroup } from "./load-group";
import { ONSHAPE_STEP_RETRIES } from "./steps";
import { reconcileThumbnails } from "../thumbnails/reconcile";

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
        const ctx = createLoadContext(this.env, sessionId, step);

        const storedGroups = await step.do("list-groups", () =>
            getDb(ctx.env.DB)
                .select({
                    groupId: groups.id,
                    documentId: groups.documentId,
                    versionId: groups.versionId
                })
                .from(groups)
                .where(eq(groups.libraryId, libraryId))
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
        // Last, so every group that was going to write rows has. A group that
        // failed kept its old rows, so its thumbnails still read as live.
        await step.do("reconcile-thumbnails", () =>
            reconcileThumbnails(ctx.env.BLOB, getDb(ctx.env.DB))
        );
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
        const ctx = createLoadContext(this.env, params.sessionId, step);

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
    const document = await ctx.step.do(
        `document${stepSuffix}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            getDocument(await getOnshapeApiFromContext(ctx), { documentId })
    );
    const versionId = await ctx.step.do(
        `version${stepSuffix}`,
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            getLatestVersionId(await getOnshapeApiFromContext(ctx), {
                documentId
            })
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
 * its first groups. Exported for its tests.
 */
export async function createShellGroup(
    env: AppBindings,
    params: AddGroupParams
): Promise<void> {
    const db = getDb(env.DB);
    await ensureLibrary(db, params.libraryId);
    // placeNewGroup renumbers siblings eagerly. Failed inserts result in a gap that's fixed on the next edit.
    const sortOrder = await placeNewGroup(
        db,
        params.libraryId,
        params.selectedGroupId
    );
    await db
        .insert(groups)
        .values({
            id: params.groupId,
            documentId: params.documentId,
            libraryId: params.libraryId,
            name: params.documentName,
            versionId: PLACEHOLDER_VERSION_ID,
            sortOrder
        })
        .onConflictDoNothing();
    // Without this the row is unreachable until the load finishes: every
    // library response is pinned to the version, immutably. No search rebuild
    // to go with it, since buildSearchDb indexes insertables and the shell has
    // none — the index the old version served is still right for the new one.
    await bumpLibraryVersion(db, params.libraryId);
}

/**
 * Records the failure on the group row, so the library flags it rather than
 * showing an empty group. A later successful load recomputes the issues afresh.
 */
async function flagFailedGroup(
    env: AppBindings,
    groupId: string
): Promise<void> {
    const db = getDb(env.DB);
    const row = await db
        .select({ buildIssues: groups.buildIssues })
        .from(groups)
        .where(eq(groups.id, groupId))
        .get();
    if (!row) {
        return;
    }
    await db
        .update(groups)
        .set({
            buildIssues: addBuildIssue(row.buildIssues, {
                type: BuildIssueType.LOAD_FAILED
            })
        })
        .where(eq(groups.id, groupId));
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
