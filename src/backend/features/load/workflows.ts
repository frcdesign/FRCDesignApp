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
    placeNewGroup
} from "../library/db";
import { getDocument } from "../../lib/onshape/endpoints/documents";
import { getLatestVersion } from "../../lib/onshape/endpoints/versions";
import type { InstancePath } from "../../lib/onshape/path";
import {
    groups,
    PLACEHOLDER_VERSION_ID,
    WebhookSubject
} from "../../db/schema";
import {
    type BuildIssue,
    BuildIssueType,
    hasBuildIssue
} from "../build-checker/issues";

import {
    type GroupTarget,
    type LoadContext,
    createLoadContext,
    getOnshapeApiFromContext
} from "./context";
import { finishLoad, type LoadDocumentParams } from "./jobs";
import { pushLibraryChanged } from "../live/notify";
import { flagGroups } from "./flag";
import { loadGroup } from "./load-group";
import { ONSHAPE_STEP_RETRIES } from "./steps";
import { ensureWebhook } from "../webhooks/registration";

/** What a load did with its group. */
export type LoadResult =
    | { status: "skipped" | "failed" | "gone" }
    | {
          status: "loaded";
          loadedElements: number;
          deletedElements: number;
          failedElements: number;
      };

/** Loads one group's document when its version moved, or on a forced reload. One per group at a time; see `jobs.ts`. */
export class LoadDocumentWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadDocumentParams
> {
    async run(
        event: WorkflowEvent<LoadDocumentParams>,
        step: WorkflowStep
    ): Promise<LoadResult> {
        const params = event.payload;
        const ctx = createLoadContext(this.env, params.sessionId, step);
        // Anything but a skip wrote to the group: a failure flags it.
        let result: LoadResult = { status: "failed" };
        try {
            result = await loadDocument(ctx, params);
            return result;
        } finally {
            // Always, so whatever queued behind this load starts.
            const changed =
                result.status === "loaded" || result.status === "failed";
            await step.do("finish", () =>
                finishLoad(this.env, params, changed)
            );
        }
    }
}

async function loadDocument(
    ctx: LoadContext,
    params: LoadDocumentParams
): Promise<LoadResult> {
    const { groupId, libraryId, forceReload } = params;
    const stored = await ctx.step.do("read-group", () =>
        getDb(ctx.env.DB)
            .select({
                documentId: groups.documentId,
                versionId: groups.versionId,
                thumbnailWorkspaceId: groups.thumbnailWorkspaceId,
                buildIssues: groups.buildIssues
            })
            .from(groups)
            .where(eq(groups.id, groupId))
            .get()
    );
    // Deleted since the load was asked for.
    if (!stored) {
        return { status: "gone" };
    }

    let result: LoadResult;
    try {
        const target = await resolveGroupTarget(ctx, {
            libraryId,
            groupId,
            documentId: stored.documentId
        });
        if (
            stored.versionId === target.versionPath.instanceId &&
            !forceReload &&
            !hasFailedLoad(stored.buildIssues)
        ) {
            result = { status: "skipped" };
        } else {
            result = {
                status: "loaded",
                ...(await loadGroup(
                    ctx,
                    target,
                    forceReload,
                    stored.thumbnailWorkspaceId
                        ? {
                              workspaceId: stored.thumbnailWorkspaceId,
                              versionId: stored.versionId
                          }
                        : undefined
                ))
            };
        }
    } catch (error) {
        // The row records only that it failed, so this is the only record of why.
        console.error(`Failed to load group ${groupId}`, error);
        await ctx.step.do("flag-failed", () =>
            flagGroups(ctx.env, [groupId], BuildIssueType.LOAD_FAILED)
        );
        result = { status: "failed" };
    }

    // After the load, so an unreadable document gets no webhook. Not fatal: the
    // next load retries.
    try {
        await ctx.step.do(
            "register-webhook",
            { retries: ONSHAPE_STEP_RETRIES },
            async () =>
                ensureWebhook(
                    ctx.env,
                    await getOnshapeApiFromContext(ctx),
                    WebhookSubject.DOCUMENT,
                    stored.documentId,
                    params.origin
                )
        );
    } catch (error) {
        console.error(
            `Failed to register a webhook for ${stored.documentId}`,
            error
        );
    }
    return result;
}

/**
 * A failure leaves the version where it was, so a group that failed on the
 * latest version would otherwise be skipped until a forced reload.
 */
function hasFailedLoad(buildIssues: BuildIssue[]): boolean {
    return hasBuildIssue(
        buildIssues,
        BuildIssueType.LOAD_FAILED,
        BuildIssueType.INSERTABLES_FAILED,
        BuildIssueType.VERSION_NOT_LOADED
    );
}

/** Reads the document and its latest version, pinning the group to that version. */
async function resolveGroupTarget(
    ctx: LoadContext,
    ids: { libraryId: LibraryId; groupId: string; documentId: string }
): Promise<GroupTarget> {
    const { documentId } = ids;
    const document = await ctx.step.do(
        "document",
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            getDocument(await getOnshapeApiFromContext(ctx), { documentId })
    );
    // `createdAt` stays a string: step results are persisted, and a Date isn't.
    const version = await ctx.step.do(
        "version",
        { retries: ONSHAPE_STEP_RETRIES },
        async () =>
            getLatestVersion(await getOnshapeApiFromContext(ctx), {
                documentId
            })
    );

    const versionPath: InstancePath = {
        documentId,
        instanceId: version.id,
        instanceType: "v"
    };
    return {
        libraryId: ids.libraryId,
        groupId: ids.groupId,
        versionPath,
        versionCreatedAt: new Date(version.createdAt),
        name: document.name,
        thumbnailElementId: document.documentThumbnailElementId
    };
}

export interface ShellGroup {
    groupId: string;
    documentId: string;
    /** The document's name, already fetched by the route. */
    documentName: string;
    libraryId: LibraryId;
    /** An existing group to place the new group after. */
    selectedGroupId?: string;
}

/** Written before the load, so a failed add still leaves a group to retry or delete. */
export async function createShellGroup(
    env: AppBindings,
    params: ShellGroup
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
    // Library responses are pinned to the version, so the row is unreachable until
    // it bumps. The search index is unaffected: the shell has no insertables.
    await bumpLibraryVersion(db, params.libraryId);
    await pushLibraryChanged(env, params.libraryId);
}
