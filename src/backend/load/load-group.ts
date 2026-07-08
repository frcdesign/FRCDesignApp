import type { WorkflowStep } from "cloudflare:workers";
import type { BatchItem } from "drizzle-orm/batch";
import { eq, inArray } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { type Db, getDb } from "../db";
import type { ElementPath, InstancePath } from "../../shared/onshape-path";
import type { ParameterObj } from "../../shared/configuration-models";
import {
    ElementType,
    type FastenInfo,
    type LibraryId,
    type ThumbnailUrls,
    type Vendor
} from "../../shared/types";
import { configurations, groups, insertables } from "../../shared/schema";
import {
    uploadDocumentThumbnails,
    uploadThumbnails,
    uploadThumbnailsWithRetry
} from "../routes/thumbnails";
import { placeNewGroup } from "../library-data";
import { getContents, getDocument } from "../onshape-api/endpoints/documents";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import type { OnshapeApi } from "../onshape-api/onshape-api";
import {
    type OnshapeDocumentContents,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import { checkGroup, checkInsertable } from "../parse/build-checks";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { parseFastenInfo } from "../parse/insert-and-fasten";

export const ELEMENT_CONCURRENCY = 4;

const DATA_RETRIES = {
    retries: { limit: 3, delay: "5 seconds", backoff: "exponential" }
} as const;

/** A single group's load job — the per-group slice of the workflow's plan. */
export interface GroupJob {
    groupId: string;
    documentId: string;
    forceReload: boolean;
    /**
     * Only meaningful when the group row doesn't exist yet. Creation is
     * detected from the db rather than declared by the caller — that's what
     * makes a replay after a committed batch converge on the update path.
     * Present → place after that sibling; absent → append.
     */
    placeAfterGroupId?: string;
}

export interface LoadDeps {
    env: AppBindings;
    sessionId: string;
    libraryId: LibraryId;
}

export type GroupResult =
    | { groupId: string; status: "skipped" }
    | {
          groupId: string;
          status: "created" | "reloaded";
          loadedElements: number;
          deletedElements: number;
      }
    /** Produced by the workflow when a group's pipeline fails for good. */
    | { groupId: string; status: "failed" };

/**
 * The group-scoped fields every element row inherits — the "shared data from
 * the calling group". It exists purely in memory: elements read it at build
 * time, never from a half-written group row.
 */
export interface GroupContext {
    libraryId: LibraryId;
    groupId: string;
    documentId: string;
    versionId: string;
}

export async function loadGroup(
    deps: LoadDeps,
    step: WorkflowStep,
    job: GroupJob
): Promise<GroupResult> {
    const { groupId, documentId } = job;

    // One memoized plan per group: the skip decision, the element diff, and —
    // because fresh insertable ids are minted inside it — ids that are stable
    // across every replay of the steps below.
    const plan = await step.do(`plan-${groupId}`, DATA_RETRIES, () =>
        planGroup(deps, job)
    );
    if (plan.skip) {
        return { groupId, status: "skipped" };
    }

    const ctx: GroupContext = {
        libraryId: deps.libraryId,
        groupId,
        documentId,
        versionId: plan.versionId
    };

    // Thumbnail steps ride uploadThumbnailsWithRetry's budget — durable,
    // runtime-managed delays spread over minutes, since Onshape renders lazily
    // after the first touch. Exhaustion resolves to null (a build issue on the
    // row); it never fails the group.
    const docThumbnails = uploadThumbnailsWithRetry(
        step,
        `doc-thumbnail-${groupId}`,
        async () =>
            uploadDocumentThumbnails(
                deps.env.THUMBNAILS,
                await api(deps),
                versionPath(documentId, plan.versionId)
            )
    );

    // Two memoized steps per element: data (required) and thumbnail
    // (best-effort), independent of each other and of every other element.
    const toLoad = plan.elements.filter((element) => element.needsReload);
    const outcomes = await mapLimit(
        toLoad,
        ELEMENT_CONCURRENCY,
        async (element): Promise<LoadedElement | null> => {
            const thumbnails = uploadThumbnailsWithRetry(
                step,
                `element-thumbnail-${groupId}-${element.elementId}`,
                async () =>
                    uploadThumbnails(
                        deps.env.THUMBNAILS,
                        await api(deps),
                        elementPathOf(ctx, element.elementId),
                        element.microversionId
                    )
            );
            try {
                const data = await step.do(
                    `element-${groupId}-${element.elementId}`,
                    DATA_RETRIES,
                    () => loadElementData(deps, ctx, element)
                );
                return {
                    plan: element,
                    parameters: data.parameters,
                    reloaded: buildReloadedFields(
                        ctx,
                        element,
                        data,
                        await thumbnails
                    )
                };
            } catch {
                // Data retries exhausted; the pending thumbnail step settles
                // to null on its own. The group decides below.
                return null;
            }
        }
    );

    // All-or-nothing: if any required fetch is unrecoverable, nothing commits.
    // The group keeps its previous state, and its unchanged versionId queues
    // the whole group for the next reload.
    const failedIds = outcomes.flatMap((outcome, index) =>
        outcome ? [] : [toLoad[index].elementId]
    );
    if (failedIds.length > 0) {
        throw new Error(
            `Group ${groupId}: elements failed to load: ${failedIds.join(", ")}`
        );
    }
    const loaded = outcomes.filter(
        (outcome): outcome is LoadedElement => outcome !== null
    );

    const docThumbnailUrls = await docThumbnails;

    const { status } = await step.do(`commit-${groupId}`, () =>
        commitGroup(getDb(deps.env.DB), {
            ctx,
            docName: plan.docName,
            hasThumbnailTab: plan.hasThumbnailTab,
            docThumbnailUrls,
            placeAfterGroupId: job.placeAfterGroupId,
            loaded,
            staleInsertableIds: plan.staleInsertableIds
        })
    );

    return {
        groupId,
        status,
        loadedElements: loaded.length,
        deletedElements: plan.staleInsertableIds.length
    };
}

// ---------------------------------------------------------------------------
// Planning — the plan step body, plus its pure core.
// ---------------------------------------------------------------------------

export type GroupPlan =
    | { skip: true }
    | {
          skip: false;
          versionId: string;
          docName: string;
          hasThumbnailTab: boolean;
          elements: ElementPlan[];
          staleInsertableIds: string[];
      };

export async function planGroup(
    deps: LoadDeps,
    job: GroupJob
): Promise<GroupPlan> {
    const onshape = await api(deps);
    const db = getDb(deps.env.DB);

    // TODO: map Onshape 401/403/404 onto NonRetryableError
    // (cloudflare:workflows) so a deleted document or revoked access fails
    // fast instead of burning retries.
    const rawDoc = await getDocument(onshape, { documentId: job.documentId });
    const versionId = rawDoc.recentVersion.id;

    const existingGroup = await db
        .select({ versionId: groups.versionId })
        .from(groups)
        .where(eq(groups.id, job.groupId))
        .get();

    if (shouldSkipGroup(existingGroup, versionId, job.forceReload)) {
        return { skip: true };
    }

    const contents = await getContents(
        onshape,
        versionPath(job.documentId, versionId)
    );
    const { elements, staleInsertableIds } = planElements(
        parseContents(contents),
        await readGroupInsertables(db, job.groupId),
        job.forceReload
    );

    return {
        skip: false,
        versionId,
        docName: rawDoc.name,
        hasThumbnailTab: !!rawDoc.documentThumbnailElementId,
        elements,
        staleInsertableIds
    };
}

/** A part studio / assembly tab from the Onshape document contents. */
export interface DocumentElement {
    elementId: string;
    name: string;
    elementType: ElementType;
    microversionId: string;
}

/** The valid tabs plus their display order — everything planning needs. */
export interface DocumentSnapshot {
    tabs: DocumentElement[];
    /** Valid tab ids in display (folder-tree) order. */
    orderedTabIds: string[];
}

export function parseContents(
    contents: OnshapeDocumentContents
): DocumentSnapshot {
    const tabs = getValidElements(contents);
    const tabIds = new Set(tabs.map((tab) => tab.elementId));
    return {
        tabs,
        orderedTabIds: getOrderedElementIds(contents).filter((id) =>
            tabIds.has(id)
        )
    };
}

/** The stored fields matching consults — what `readGroupInsertables` selects. */
export interface ExistingInsertable {
    id: string;
    elementId: string;
    microversionId: string;
    supportsFasten: boolean;
}

export async function readGroupInsertables(
    db: Db,
    groupId: string
): Promise<ExistingInsertable[]> {
    return db
        .select({
            id: insertables.id,
            elementId: insertables.elementId,
            microversionId: insertables.microversionId,
            supportsFasten: insertables.supportsFasten
        })
        .from(insertables)
        .where(eq(insertables.groupId, groupId));
}

/** A tab matched against the db: the tab's fields plus the match decisions. */
export interface ElementPlan extends DocumentElement {
    /** The existing row's id, or a freshly minted one for a new element. */
    insertableId: string;
    isNew: boolean;
    /** Stored insert-and-fasten preference — gates re-parsing fasten info. */
    supportsFasten: boolean;
    /** Tab-order position. Seeds sortOrder on insert; never touched on reload. */
    sortOrder: number;
    needsReload: boolean;
}

export interface GroupElementsPlan {
    elements: ElementPlan[];
    staleInsertableIds: string[];
}

/**
 * Pure diff of the Onshape snapshot against the stored rows: which elements to
 * (re)load, which rows to delete, and each element's resolved id. This runs
 * inside the memoized plan step, so freshly minted ids are stable across every
 * replay.
 */
export function planElements(
    snapshot: DocumentSnapshot,
    existing: ExistingInsertable[],
    forceReload: boolean
): GroupElementsPlan {
    const existingByElementId = new Map(
        existing.map((row) => [row.elementId, row])
    );
    const sortOrderByElementId = new Map(
        snapshot.orderedTabIds.map((id, index) => [id, index])
    );

    const elements = snapshot.tabs.map((tab): ElementPlan => {
        const stored = existingByElementId.get(tab.elementId);
        return {
            ...tab,
            insertableId: stored?.id ?? crypto.randomUUID(),
            isNew: !stored,
            supportsFasten: stored?.supportsFasten ?? false,
            sortOrder: sortOrderByElementId.get(tab.elementId) ?? 0,
            needsReload:
                forceReload ||
                !stored ||
                stored.microversionId !== tab.microversionId
        };
    });

    const tabIds = new Set(snapshot.tabs.map((tab) => tab.elementId));
    const staleInsertableIds = existing
        .filter((row) => !tabIds.has(row.elementId))
        .map((row) => row.id);

    return { elements, staleInsertableIds };
}

/**
 * The group-level skip. Sound because the commit is atomic: a half-loaded
 * group can never have claimed a versionId, so a matching versionId always
 * means "fully loaded at exactly this version".
 */
export function shouldSkipGroup(
    stored: { versionId: string } | undefined,
    latestVersionId: string,
    forceReload: boolean
): boolean {
    return (
        stored !== undefined &&
        stored.versionId === latestVersionId &&
        !forceReload
    );
}

// ---------------------------------------------------------------------------
// Element loading — the data step body, plus the pure join with thumbnails.
// ---------------------------------------------------------------------------

/** The required per-element data — everything except the thumbnail. */
export interface ElementData {
    parameters: ParameterObj[] | null;
    vendors: Vendor[];
    fastenInfo: FastenInfo | null;
}

/** One fully fetched element, ready to drop into the group's batch. */
export interface LoadedElement {
    plan: ElementPlan;
    reloaded: ReloadedFields;
    /** null → no configuration (any stale config row gets deleted). */
    parameters: ParameterObj[] | null;
}

/**
 * The element data step body. A failure here fails the step (and, once retries
 * are exhausted, the group) — configuration and fasten info are required.
 */
export async function loadElementData(
    deps: LoadDeps,
    ctx: GroupContext,
    plan: ElementPlan
): Promise<ElementData> {
    const onshape = await api(deps);
    const path = elementPathOf(ctx, plan.elementId);

    const rawConfig = await getConfiguration(onshape, path);
    const parameters =
        rawConfig.configurationParameters.length === 0
            ? null
            : parseOnshapeConfiguration(rawConfig).parameters;

    const vendors = parseVendors(
        plan.name,
        parameters ? { parameters } : undefined
    );

    // Never parsed for a brand-new element; gated by the stored preference on
    // reload — same semantics as before.
    const fastenInfo =
        !plan.isNew && plan.supportsFasten
            ? await parseFastenInfo(onshape, path, plan.elementType)
            : null;

    return { parameters, vendors, fastenInfo };
}

/** Joins an element's data step and thumbnail step into its reload-owned fields. */
export function buildReloadedFields(
    ctx: GroupContext,
    plan: ElementPlan,
    data: ElementData,
    thumbnailUrls: ThumbnailUrls | null
): ReloadedFields {
    return {
        name: plan.name,
        elementType: plan.elementType,
        microversionId: plan.microversionId,
        versionId: ctx.versionId,
        vendors: data.vendors,
        thumbnailUrls,
        fastenInfo: data.fastenInfo,
        buildIssues: checkInsertable({ vendors: data.vendors, thumbnailUrls })
    };
}

type InsertableRow = typeof insertables.$inferInsert;

/** Written once when the row is created; never updated. */
type IdentityColumns =
    | "id"
    | "libraryId"
    | "groupId"
    | "documentId"
    | "elementId";

/**
 * Owned by the user after creation.
 */
type UserOwnedColumns =
    | "sortOrder"
    | "isVisible"
    | "isOpenComposite"
    | "supportsFasten";

/** Everything else: recomputed from Onshape on every load. */
type ReloadedColumns = Exclude<
    keyof InsertableRow,
    IdentityColumns | UserOwnedColumns
>;

type IdentityFields = Required<Pick<InsertableRow, IdentityColumns>>;
type UserOwnedFields = Required<Pick<InsertableRow, UserOwnedColumns>>;
export type ReloadedFields = Required<Pick<InsertableRow, ReloadedColumns>>;

type GroupRow = typeof groups.$inferInsert;
type GroupIdentityColumns = "id" | "documentId" | "libraryId";
/**
 * Extend this if the groups schema grows more user-owned columns (e.g. a
 * sortAlphabetically flag) — the ReloadedGroupFields annotation will insist.
 */
type GroupUserOwnedColumns = "sortOrder";
export type ReloadedGroupFields = Required<
    Pick<
        GroupRow,
        Exclude<keyof GroupRow, GroupIdentityColumns | GroupUserOwnedColumns>
    >
>;

function identityFields(ctx: GroupContext, plan: ElementPlan): IdentityFields {
    return {
        id: plan.insertableId,
        libraryId: ctx.libraryId,
        groupId: ctx.groupId,
        documentId: ctx.documentId,
        elementId: plan.elementId
    };
}

/**
 * The user-owned columns' new-row seeds. On an existing row the upsert
 * discards these (its conflict set omits them), so they only ever land when
 * the row is first inserted — that is the preservation guarantee.
 */
function newRowUserFields(plan: ElementPlan): UserOwnedFields {
    return {
        // Seeded from the tab-manager position; the user owns ordering after.
        sortOrder: plan.sortOrder,
        // Keep these two literals in sync with the schema column defaults.
        isVisible: true,
        isOpenComposite: false,
        // The stored preference (always false for a brand-new element).
        supportsFasten: plan.supportsFasten
    };
}

/** A complete row for the upsert's VALUES: identity + user seeds + reloaded. */
export function buildInsertableRow(
    ctx: GroupContext,
    plan: ElementPlan,
    reloaded: ReloadedFields
): InsertableRow {
    return {
        ...identityFields(ctx, plan),
        ...newRowUserFields(plan),
        ...reloaded
    };
}

// ---------------------------------------------------------------------------
// Commit — the group's single atomic batch.
// ---------------------------------------------------------------------------

export type Statement = BatchItem<"sqlite">;

export interface GroupCommit {
    ctx: GroupContext;
    docName: string;
    hasThumbnailTab: boolean;
    docThumbnailUrls: ThumbnailUrls | null;
    /** Consulted only when the group row doesn't exist yet. */
    placeAfterGroupId?: string;
    loaded: LoadedElement[];
    staleInsertableIds: string[];
}

/**
 * The commit step body: one atomic `db.batch()` for the whole group. Existence
 * is re-checked here (not trusted from the memoized plan) so a replay after a
 * committed batch takes the update path instead of re-placing the group.
 */
export async function commitGroup(
    db: Db,
    commit: GroupCommit
): Promise<{ status: "created" | "reloaded" }> {
    const { ctx } = commit;
    const exists = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.id, ctx.groupId))
        .get();

    // placeNewGroup may renumber siblings eagerly, before the batch. If the
    // batch then fails, the worst case is a harmless sortOrder gap the retry
    // re-derives. Fold its statements into the batch to make it airtight.
    const sortOrder = exists
        ? undefined
        : await placeNewGroup(
              db,
              ctx.libraryId,
              ctx.groupId,
              commit.placeAfterGroupId
          );

    await db.batch(buildCommitBatch(db, commit, sortOrder));
    return { status: exists ? "reloaded" : "created" };
}

/**
 * Builds the group's batch: group upsert, element upserts, configuration
 * upserts/deletes, and stale-row deletes. Exported so tests can apply it to a
 * database directly — including twice in a row, to assert that replays
 * converge instead of duplicating.
 */
export function buildCommitBatch(
    db: Db,
    commit: GroupCommit,
    /** Defined only when the group is being created. */
    sortOrder: number | undefined
): [Statement, ...Statement[]] {
    const { ctx, loaded, staleInsertableIds } = commit;

    const groupFields: ReloadedGroupFields = {
        name: commit.docName,
        versionId: ctx.versionId,
        thumbnailUrls: commit.docThumbnailUrls,
        buildIssues: checkGroup({
            hasThumbnailTab: commit.hasThumbnailTab,
            thumbnailUrls: commit.docThumbnailUrls
        })
    };

    // An upsert, so the create path and a replay converge on one statement.
    // The conflict set is exactly the reload-owned fields — sortOrder is never
    // touched after creation.
    const groupWrite = db
        .insert(groups)
        .values({
            id: ctx.groupId,
            documentId: ctx.documentId,
            libraryId: ctx.libraryId,
            sortOrder: sortOrder ?? 0,
            ...groupFields
        })
        .onConflictDoUpdate({ target: groups.id, set: groupFields });

    const insertableWrites = loaded.map(({ plan, reloaded }) =>
        db
            .insert(insertables)
            .values(buildInsertableRow(ctx, plan, reloaded))
            .onConflictDoUpdate({
                target: [insertables.groupId, insertables.elementId],
                set: reloaded
            })
    );

    const configWrites = loaded.flatMap(({ plan, parameters }) => {
        if (parameters !== null) {
            return [
                db
                    .insert(configurations)
                    .values({ id: plan.insertableId, parameters })
                    .onConflictDoUpdate({
                        target: configurations.id,
                        set: { parameters }
                    })
            ];
        }
        // The element no longer has a configuration — drop the stale row
        // rather than leaking it.
        return plan.isNew
            ? []
            : [
                  db
                      .delete(configurations)
                      .where(eq(configurations.id, plan.insertableId))
              ];
    });

    // Elements removed from the document take their configurations with them.
    const staleDeletes =
        staleInsertableIds.length === 0
            ? []
            : [
                  db
                      .delete(configurations)
                      .where(inArray(configurations.id, staleInsertableIds)),
                  db
                      .delete(insertables)
                      .where(inArray(insertables.id, staleInsertableIds))
              ];

    return [groupWrite, ...insertableWrites, ...configWrites, ...staleDeletes];
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

/** Resolved fresh per step body, so replays after a token refresh stay valid. */
function api(deps: LoadDeps): Promise<OnshapeApi> {
    return getOnshapeApiForSessionId(deps.env.KV, deps.sessionId);
}

export function versionPath(
    documentId: string,
    versionId: string
): InstancePath {
    return { documentId, instanceId: versionId, instanceType: "v" };
}

export function elementPathOf(
    ref: { documentId: string; versionId: string },
    elementId: string
): ElementPath {
    return { ...versionPath(ref.documentId, ref.versionId), elementId };
}

/**
 * Promise.all with a concurrency cap, preserving input order. Dispatch
 * throttling only — retries belong to the steps this dispatches.
 */
export async function mapLimit<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (nextIndex < items.length) {
                const index = nextIndex++;
                results[index] = await fn(items[index]);
            }
        }
    );
    await Promise.all(workers);
    return results;
}

// ---------------------------------------------------------------------------
// Pure helpers for the document contents tree (unchanged).
// ---------------------------------------------------------------------------

const VALID_ELEMENT_TYPES = new Set<string>([
    ElementType.ASSEMBLY,
    ElementType.PART_STUDIO
]);

function* traverseEntry(entry: OnshapeFolderEntry): Generator<string> {
    if (entry.btType === OnshapeFolderEntryType.GROUP) {
        for (const child of entry.groups) yield* traverseEntry(child);
    } else if (entry.btType === OnshapeFolderEntryType.ELEMENT) {
        yield entry.elementId;
    }
}

/** Element ids in display (folder-tree) order. */
export function getOrderedElementIds(
    contents: OnshapeDocumentContents
): string[] {
    const ids: string[] = [];
    for (const entry of contents.folders.groups) {
        ids.push(...traverseEntry(entry));
    }
    return ids;
}

/** The part studio / assembly elements we load, with the fields we persist. */
export function getValidElements(
    contents: OnshapeDocumentContents
): DocumentElement[] {
    return contents.elements
        .filter((e) => VALID_ELEMENT_TYPES.has(e.elementType))
        .map((e) => ({
            elementId: e.id,
            name: e.name,
            // OnshapeElementType and the app ElementType share these values.
            elementType: e.elementType as unknown as ElementType,
            microversionId: e.microversionId
        }));
}
