import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { notInArray } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { WebhookSubject } from "../../db/schema";
import { createLimiter, type Limiter } from "../../lib/limiter";
import type { OAuthApi } from "../../lib/onshape/client";
import { downloadBlob } from "../../lib/onshape/endpoints/blobs";
import {
    getContents,
    getDocument
} from "../../lib/onshape/endpoints/documents";
import { getLatestVersion } from "../../lib/onshape/endpoints/versions";
import {
    type ElementPath,
    type InstancePath,
    toDefaultWorkspacePath
} from "../../lib/onshape/path";
import type { OnshapeElement } from "../../lib/onshape/types";
import { getBackgroundOnshapeApi } from "../auth/background-sessions";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import { withoutDeprecated } from "../load/parse-document-contents";
import { ONSHAPE_STEP_RETRIES, uploadThumbnailsStep } from "../load/steps";
import { pushFeatureScriptsChanged } from "../push/notify";
import type { ThumbnailUrls } from "../thumbnails/contract";
import { deleteStaleThumbnails } from "../thumbnails/reconcile";
import { uploadThumbnails } from "../thumbnails/store";
import { ensureWebhook } from "../webhooks/registration";
import { FeatureScriptProblem } from "./contract";
import {
    claimLoad,
    LOAD_TURN_INTERVAL,
    type LoadFeatureScriptsParams,
    releaseLoad
} from "./load-claim";
import {
    categoryOf,
    findExample,
    findManifestTab,
    type ManifestFeature,
    parseManifest,
    tabOrder
} from "./manifest";
import {
    type FeatureScriptRow,
    featureScripts,
    featureScriptsDocument
} from "./schema";
import { ICON_PREFIX, iconKey } from "./store";

/** Onshape calls in flight at once; the frontend document has tens of features. */
const LOAD_CONCURRENCY = 10;

/** An icon is stored before the row naming it, as a thumbnail is. */
const STALE_ICON_GRACE_MS = 60 * 60 * 1000;

interface FeatureScriptsLoadContext {
    env: AppBindings;
    step: WorkflowStep;
    sessionId?: string;
    limit: Limiter;
    thumbnailLimit: Limiter;
    api?: Promise<OAuthApi>;
}

/** The requester's session while it works, else the owner's; never a library team's. */
async function getApi(ctx: FeatureScriptsLoadContext): Promise<OAuthApi> {
    if (ctx.sessionId) {
        try {
            return await getOnshapeApiFromSessionId(ctx.env.KV, ctx.sessionId);
        } catch {
            // Signed out since asking; the owner's background session carries on.
        }
    }
    ctx.api ??= getBackgroundOnshapeApi(ctx.env, []).then((api) => {
        if (!api) {
            throw new Error("No owner session to load FeatureScripts with");
        }
        return api;
    });
    // A failure is retried by the step, so it must not be memoized.
    return ctx.api.catch((error: unknown) => {
        ctx.api = undefined;
        throw error;
    });
}

/**
 * Loads the latest version of the frontend document: the features its
 * manifest lists, each feature's example and icon, and its category.
 */
export class LoadFeatureScriptsWorkflow extends WorkflowEntrypoint<
    AppBindings,
    LoadFeatureScriptsParams
> {
    async run(
        event: WorkflowEvent<LoadFeatureScriptsParams>,
        step: WorkflowStep
    ): Promise<void> {
        const documentId = this.env.FEATURESCRIPTS_DOCUMENT_ID;
        if (!documentId) {
            console.warn(
                "FEATURESCRIPTS_DOCUMENT_ID is unset; nothing to load"
            );
            return;
        }
        const { instanceId } = event;
        for (let turn = 0; ; turn++) {
            if (turn > 0) {
                await step.sleep(`wait-${turn}`, LOAD_TURN_INTERVAL);
            }
            if (
                await step.do(`claim-${turn}`, () =>
                    claimLoad(this.env, instanceId)
                )
            ) {
                break;
            }
        }
        const ctx: FeatureScriptsLoadContext = {
            env: this.env,
            step,
            sessionId: event.payload.sessionId,
            limit: createLimiter(LOAD_CONCURRENCY),
            thumbnailLimit: createLimiter(LOAD_CONCURRENCY)
        };
        try {
            await loadFeatureScripts(ctx, documentId, event.payload.force);
        } finally {
            await step.do("release", () => releaseLoad(this.env, instanceId));
        }
    }
}

/** A manifest entry paired with the tabs it names in this version. */
interface LoadedEntry {
    feature: ManifestFeature;
    studio: OnshapeElement;
    example?: OnshapeElement;
    icon?: OnshapeElement;
    /** The manifest names an icon tab the version doesn't have. */
    missingIcon: boolean;
    category?: string;
    sortOrder: number;
}

async function loadFeatureScripts(
    ctx: FeatureScriptsLoadContext,
    documentId: string,
    force: boolean
): Promise<void> {
    const { env, step } = ctx;
    const db = getDb(env.DB);

    const document = await step.do(
        "document",
        { retries: ONSHAPE_STEP_RETRIES },
        async () => getDocument(await getApi(ctx), { documentId })
    );
    const version = await step.do(
        "version",
        { retries: ONSHAPE_STEP_RETRIES },
        async () => getLatestVersion(await getApi(ctx), { documentId })
    );
    const workspacePath = toDefaultWorkspacePath(document);
    if (!workspacePath) {
        throw new Error(`Document ${documentId} reports no default workspace`);
    }
    const versionPath: InstancePath = {
        documentId,
        instanceType: "v",
        instanceId: version.id
    };

    const stored = await step.do("read-stored", async () => ({
        versionId: (await db.select().from(featureScriptsDocument).get())
            ?.versionId,
        rows: await db.select().from(featureScripts)
    }));
    const failedBefore = stored.rows.some((row) =>
        row.problems.includes(FeatureScriptProblem.LOAD_FAILED)
    );
    if (stored.versionId === version.id && !force && !failedBefore) {
        await registerWebhook(ctx, documentId);
        return;
    }

    const contents = await step.do(
        "contents",
        { retries: ONSHAPE_STEP_RETRIES },
        async () => getContents(await getApi(ctx), versionPath)
    );
    const manifestTab = findManifestTab(contents);
    if (!manifestTab) {
        throw new Error(
            `Version ${version.name} of the frontend document has no featurescripts.json`
        );
    }
    const manifestText = await step.do(
        "manifest",
        { retries: ONSHAPE_STEP_RETRIES },
        async () => {
            const response = await downloadBlob(await getApi(ctx), {
                ...versionPath,
                elementId: manifestTab.id
            });
            return response.text();
        }
    );
    let manifest;
    try {
        manifest = parseManifest(JSON.parse(manifestText));
    } catch (error) {
        throw new NonRetryableError(
            `featurescripts.json in version ${version.name} doesn't parse: ${String(error)}`
        );
    }

    const entries = pairEntries(contents, manifest.features);
    const storedByElement = new Map(
        stored.rows.map((row) => [row.elementId, row])
    );
    const selected = entries.filter((entry) =>
        needsLoad(entry, storedByElement.get(entry.studio.id), force)
    );

    const elementPath = (tab: OnshapeElement): ElementPath => ({
        ...versionPath,
        elementId: tab.id
    });

    // Features sharing an example share its thumbnail, rendered once.
    const thumbnails = new Map<string, Promise<ThumbnailUrls | null>>();
    const thumbnailOf = (example: OnshapeElement) => {
        const key = `${example.id}-${example.microversionId}`;
        let upload = thumbnails.get(key);
        if (!upload) {
            upload = uploadThumbnailsStep(ctx, `thumbnail-${key}`, async () =>
                uploadThumbnails(
                    env.BLOB,
                    await getApi(ctx),
                    elementPath(example),
                    { ...workspacePath, elementId: example.id },
                    example.microversionId,
                    force
                )
            );
            thumbnails.set(key, upload);
        }
        return upload;
    };
    const storeIcon = async (icon: OnshapeElement): Promise<boolean> => {
        try {
            await ctx.limit(() =>
                step.do(
                    `icon-${icon.id}-${icon.microversionId}`,
                    { retries: ONSHAPE_STEP_RETRIES },
                    async () => {
                        const key = iconKey(icon.id, icon.microversionId);
                        if (!force && (await env.BLOB.head(key))) {
                            return;
                        }
                        const response = await downloadBlob(
                            await getApi(ctx),
                            elementPath(icon)
                        );
                        await env.BLOB.put(key, await response.arrayBuffer(), {
                            httpMetadata: { contentType: "image/svg+xml" }
                        });
                    }
                )
            );
            return true;
        } catch (error) {
            console.error(`Failed to store the icon ${icon.id}`, error);
            return false;
        }
    };

    const loaded = new Map(
        await Promise.all(
            selected.map(async (entry) => {
                const [thumbnailUrls, iconStored] = await Promise.all([
                    entry.example ? thumbnailOf(entry.example) : null,
                    entry.icon ? storeIcon(entry.icon) : false
                ]);
                return [
                    entry.studio.id,
                    { thumbnailUrls, iconStored }
                ] as const;
            })
        )
    );

    const values = entries.map((entry) => {
        const previous = storedByElement.get(entry.studio.id);
        const result = loaded.get(entry.studio.id);
        const thumbnailUrls = result
            ? result.thumbnailUrls
            : (previous?.thumbnailUrls ?? null);
        const hasIcon = result ? result.iconStored : !!previous?.iconElementId;
        const problems: FeatureScriptProblem[] = [];
        if (!entry.example) {
            problems.push(FeatureScriptProblem.NO_EXAMPLE);
        }
        if (!entry.icon && !entry.missingIcon) {
            problems.push(FeatureScriptProblem.NO_ICON);
        }
        const failed =
            entry.missingIcon ||
            (entry.icon && !hasIcon) ||
            (entry.example && !thumbnailUrls);
        if (failed) {
            problems.push(FeatureScriptProblem.LOAD_FAILED);
        }
        return {
            elementId: entry.studio.id,
            microversionId: entry.studio.microversionId,
            featureType: entry.feature.featureType,
            name: entry.feature.name,
            description: entry.feature.description,
            category: entry.category ?? null,
            releaseVersion: entry.feature.version ?? null,
            sourceUrl: entry.feature.sourceUrl ?? null,
            exampleElementId: entry.example?.id ?? null,
            exampleMicroversionId: entry.example?.microversionId ?? null,
            iconElementId: entry.icon && hasIcon ? entry.icon.id : null,
            iconMicroversionId:
                entry.icon && hasIcon ? entry.icon.microversionId : null,
            thumbnailUrls,
            problems,
            sortOrder: entry.sortOrder
        };
    });

    await step.do("save", () => saveLoad(env, documentId, version.id, values));
    await step.do("push", () => pushFeatureScriptsChanged(env));

    // Not fatal: anything left behind is cleaned up by the next load.
    try {
        await step.do("delete-stale", () =>
            deleteStale(env, documentId, stored.rows, values)
        );
    } catch (error) {
        console.error("Failed to delete stale FeatureScripts files", error);
    }
    await registerWebhook(ctx, documentId);
}

/** Each manifest entry whose Feature Studio is in the version, with its tabs. */
function pairEntries(
    contents: Parameters<typeof findExample>[0],
    features: ManifestFeature[]
): LoadedEntry[] {
    const current = withoutDeprecated(contents);
    const byId = new Map(contents.elements.map((tab) => [tab.id, tab]));
    const order = tabOrder(contents);
    return features.flatMap((feature): LoadedEntry[] => {
        const studio = byId.get(feature.studioElementId);
        if (!studio) {
            console.error(
                `The manifest names ${feature.name}'s studio ${feature.studioElementId}, which the version doesn't have`
            );
            return [];
        }
        const icon = feature.iconElementId
            ? byId.get(feature.iconElementId)
            : undefined;
        return [
            {
                feature,
                studio,
                example: findExample(current, studio.id, feature.name),
                icon,
                missingIcon: !!feature.iconElementId && !icon,
                category: categoryOf(contents, studio.id),
                sortOrder: order.get(studio.id) ?? order.size
            }
        ];
    });
}

/** New, changed in any tab it reads, failed last time, or forced. */
function needsLoad(
    entry: LoadedEntry,
    previous: FeatureScriptRow | undefined,
    force: boolean
): boolean {
    return (
        force ||
        !previous ||
        previous.problems.includes(FeatureScriptProblem.LOAD_FAILED) ||
        previous.microversionId !== entry.studio.microversionId ||
        previous.exampleElementId !== (entry.example?.id ?? null) ||
        previous.exampleMicroversionId !==
            (entry.example?.microversionId ?? null) ||
        previous.iconElementId !== (entry.icon?.id ?? null) ||
        previous.iconMicroversionId !== (entry.icon?.microversionId ?? null)
    );
}

type FeatureScriptValues = Omit<
    typeof featureScripts.$inferInsert,
    "id" | "isVisible"
>;

/** Every row at once, with the version and a bumped cache version, so a reader sees one load or the other. */
async function saveLoad(
    env: AppBindings,
    documentId: string,
    versionId: string,
    values: FeatureScriptValues[]
): Promise<void> {
    const db = getDb(env.DB);
    const elementIds = values.map((value) => value.elementId);
    const previous = await db.select().from(featureScriptsDocument).get();
    await db.batch([
        elementIds.length > 0
            ? db
                  .delete(featureScripts)
                  .where(notInArray(featureScripts.elementId, elementIds))
            : db.delete(featureScripts),
        // A new feature starts visible; a load never writes the owner's choice.
        ...values.map((value) =>
            db.insert(featureScripts).values(value).onConflictDoUpdate({
                target: featureScripts.elementId,
                set: value
            })
        ),
        db.delete(featureScriptsDocument),
        db.insert(featureScriptsDocument).values({
            documentId,
            versionId,
            cacheVersion: (previous?.cacheVersion ?? 0) + 1
        })
    ]);
}

/** Thumbnails and icons that no row names any more, past a grace period. */
async function deleteStale(
    env: AppBindings,
    documentId: string,
    before: FeatureScriptRow[],
    after: FeatureScriptValues[]
): Promise<void> {
    const examples = [...before, ...after].flatMap((row) =>
        row.exampleElementId ? [row.exampleElementId] : []
    );
    await deleteStaleThumbnails(env.BLOB, getDb(env.DB), {
        documentId,
        elementIds: examples,
        alsoLive: after.flatMap((row) =>
            row.exampleElementId && row.exampleMicroversionId
                ? [
                      {
                          elementId: row.exampleElementId,
                          microversionId: row.exampleMicroversionId
                      }
                  ]
                : []
        )
    });

    const liveIcons = new Set(
        after.flatMap((row) =>
            row.iconElementId && row.iconMicroversionId
                ? [iconKey(row.iconElementId, row.iconMicroversionId)]
                : []
        )
    );
    const now = Date.now();
    let cursor: string | undefined;
    do {
        const listed = await env.BLOB.list({ prefix: ICON_PREFIX, cursor });
        const stale = listed.objects
            .filter(
                (object) =>
                    !liveIcons.has(object.key) &&
                    now - object.uploaded.getTime() >= STALE_ICON_GRACE_MS
            )
            .map((object) => object.key);
        if (stale.length > 0) {
            await env.BLOB.delete(stale);
        }
        cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
}

/** After the load, so an unreadable document gets no webhook. Not fatal: the next load retries. */
async function registerWebhook(
    ctx: FeatureScriptsLoadContext,
    documentId: string
): Promise<void> {
    try {
        await ctx.step.do(
            "register-webhook",
            { retries: ONSHAPE_STEP_RETRIES },
            async () =>
                ensureWebhook(
                    ctx.env,
                    await getApi(ctx),
                    WebhookSubject.FEATURESCRIPTS,
                    documentId
                )
        );
    } catch (error) {
        console.error("Failed to register the FeatureScripts webhook", error);
    }
}
