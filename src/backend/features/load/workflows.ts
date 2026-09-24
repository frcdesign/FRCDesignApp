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
    addBuildIssue,
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

/**
 * Loads one group's document: when its version has moved on, or always on a
 * forced reload. New versions, added documents and forced reloads all come
 * through here, one instance per group at a time; see `jobs.ts`.
 */
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
            // Whatever happened, so the group is let go and whatever queued
            // behind this load starts.
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
                ...(await loadGroup(ctx, target, forceReload))
            };
        }
    } catch (error) {
        // The only record of why: the group row stores that it failed, never
        // what failed.
        console.error(`Failed to load group ${groupId}`, error);
        await ctx.step.do("flag-failed", () =>
            flagFailedGroup(ctx.env, groupId)
        );
        result = { status: "failed" };
    }

    // After the load rather than before, so a document that cannot be read
    // does not get a webhook. Its failure is logged rather than failing the
    // load: the document is loaded either way, and the next load tries again.
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
 * Whether the group's stored issues record a load that did not finish. The
 * version alone cannot decide a skip: a failure leaves the row's version where
 * it was, so a group that failed while already on the latest version — a forced
 * reload, or a blip in the version probe below, which runs even for a group that
 * is about to be skipped — would keep its flag until someone forced another.
 */
function hasFailedLoad(buildIssues: BuildIssue[]): boolean {
    return hasBuildIssue(
        buildIssues,
        BuildIssueType.LOAD_FAILED,
        BuildIssueType.INSERTABLES_FAILED
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
    // The step hands back what Onshape sent, `createdAt` still an ISO string:
    // a step's result is persisted for replay, which a Date does not survive.
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

/**
 * Writes the group row a load then fills in, creating the library if this is
 * its first group. Written before the load is asked for, so an add whose load
 * fails still leaves a group an editor can see, retry or delete.
 */
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
    // Without this the row is unreachable until the load finishes: every
    // library response is pinned to the version, immutably. No search rebuild
    // to go with it, since buildSearchDb indexes insertables and the shell has
    // none — the index the old version served is still right for the new one.
    await bumpLibraryVersion(db, params.libraryId);
    await pushLibraryChanged(env, params.libraryId);
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
