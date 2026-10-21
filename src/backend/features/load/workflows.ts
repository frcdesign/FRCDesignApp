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
import {
    type InstancePath,
    toDefaultWorkspacePath
} from "../../lib/onshape/path";
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
import {
    APPROVAL_TIMEOUT,
    APPROVE_EVENT,
    claimLibrary,
    finishReload,
    releaseHold,
    reportProgress,
    TURN_INTERVAL,
    type ReloadParams,
    type RunningReload
} from "./jobs";
import { pushLibraryChanged } from "../push/notify";
import { flagFailedLoads } from "./flag";
import { loadGroup } from "./load-group";
import { ONSHAPE_STEP_RETRIES, prefixSteps } from "./steps";
import { ensureWebhook } from "../webhooks/registration";

/**
 * Reloads a library's groups, all of them or the few it is given. One holds a
 * library at a time; another waits its turn. A webhook's waits for approval
 * first. Every group shares the run's Onshape budget, and the search index is
 * rebuilt once, at the end.
 */
export class ReloadLibraryWorkflow extends WorkflowEntrypoint<
    AppBindings,
    ReloadParams
> {
    async run(
        event: WorkflowEvent<ReloadParams>,
        step: WorkflowStep
    ): Promise<void> {
        const params = event.payload;
        const instanceId = event.instanceId;
        if (params.held) {
            await waitForApproval(this.env, step, params, instanceId);
        }

        let claim: RunningReload | undefined;
        for (let turn = 0; !claim; turn++) {
            if (turn > 0) {
                await step.sleep(`wait-${turn}`, TURN_INTERVAL);
            }
            claim = await step.do(`claim-${turn}`, () =>
                claimLibrary(this.env, params, instanceId)
            );
        }

        const ctx = createLoadContext(
            this.env,
            params.libraryId,
            params.sessionId,
            step
        );
        // A throw past loadDocument's own handling may have written too.
        let changed = true;
        try {
            changed = await reloadGroups(ctx, params, claim);
        } finally {
            // Always, so the next reload of the library can start.
            await step.do("finish", () =>
                finishReload(this.env, params.libraryId, instanceId, changed)
            );
        }
    }
}

/** Loads anyway once nobody has approved it for `APPROVAL_TIMEOUT`. */
async function waitForApproval(
    env: AppBindings,
    step: WorkflowStep,
    params: ReloadParams,
    instanceId: string
): Promise<void> {
    try {
        await step.waitForEvent("approval", {
            type: APPROVE_EVENT,
            timeout: APPROVAL_TIMEOUT
        });
    } catch {
        // Timed out.
    }
    await step.do("release-hold", () => releaseHold(env, params, instanceId));
}

/** Every group at once; their Onshape calls share the run's limiter. */
async function reloadGroups(
    ctx: LoadContext,
    params: ReloadParams,
    claim: RunningReload
): Promise<boolean> {
    const remaining = new Set(claim.loadingGroupIds);
    // Chained, so an older report never lands after a newer one.
    let reported = Promise.resolve();
    const results = await Promise.all(
        params.groupIds.map(async (groupId) => {
            const changed = await loadDocument(
                { ...ctx, step: prefixSteps(ctx.step, `${groupId}-`) },
                groupId,
                params.forceReload
            );
            remaining.delete(groupId);
            const progress = { ...claim, loadingGroupIds: [...remaining] };
            reported = reported.then(() =>
                reportProgress(ctx.env, params.libraryId, progress)
            );
            return changed;
        })
    );
    await reported;
    return results.some(Boolean);
}

/** Whether it wrote to the group, which a failure does by flagging it. */
async function loadDocument(
    ctx: LoadContext,
    groupId: string,
    forceReload: boolean
): Promise<boolean> {
    const { libraryId } = ctx;
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
    // Deleted since the reload was asked for.
    if (!stored) {
        return false;
    }

    let changed = true;
    try {
        const target = await resolveGroupTarget(ctx, {
            libraryId,
            groupId,
            documentId: stored.documentId
        });
        const isNewVersion = stored.versionId !== target.versionPath.instanceId;
        if (
            !isNewVersion &&
            !forceReload &&
            !hasFailedLoad(stored.buildIssues)
        ) {
            changed = false;
        } else {
            await loadGroup(ctx, target, forceReload);
        }
    } catch (error) {
        // The row records only that it failed, so this is the only record of why.
        console.error(`Failed to load group ${groupId}`, error);
        await ctx.step.do("flag-failed", () =>
            flagFailedLoads(ctx.env, [groupId])
        );
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
                    stored.documentId
                )
        );
    } catch (error) {
        console.error(
            `Failed to register a webhook for ${stored.documentId}`,
            error
        );
    }
    return changed;
}

/**
 * A failure leaves the version where it was, so a group that failed on the
 * latest version would otherwise be skipped until a forced reload.
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
    const workspacePath = toDefaultWorkspacePath(document);
    // Thrown rather than guessed: a guess would read another document's thumbnails.
    if (!workspacePath) {
        throw new Error(`Document ${documentId} reports no default workspace`);
    }
    return {
        libraryId: ids.libraryId,
        groupId: ids.groupId,
        versionPath,
        versionCreatedAt: new Date(version.createdAt),
        workspacePath,
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
            sortOrder,
            // Says so even if the load never starts; the first save clears it.
            buildIssues: [{ type: BuildIssueType.NOT_LOADED }]
        })
        .onConflictDoNothing();
    // Library responses are pinned to the version, so the row is unreachable until
    // it bumps. The search index is unaffected: the shell has no insertables.
    await bumpLibraryVersion(db, params.libraryId);
    await pushLibraryChanged(env, params.libraryId);
}
