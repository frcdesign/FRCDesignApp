import type { WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { eq, inArray } from "drizzle-orm";
import { type Db, getDb } from "../db";
import { ElementType } from "../../shared/types";
import { group, insertables } from "../../shared/schema";
import {
    uploadDocumentThumbnails,
    uploadThumbnailsWithRetry
} from "../routes/thumbnails";
import { getContents } from "../onshape-api/endpoints/documents";
import {
    type OnshapeDocumentContents,
    type OnshapeDocumentInfo,
    type OnshapeFolderEntry,
    OnshapeFolderEntryType
} from "../onshape-api/onshape-types";
import { checkGroup } from "../parse/build-checks";
import {
    DATA_RETRIES,
    type InheritedProps,
    type InsertableJob,
    type LoadDeps,
    type Statement,
    api,
    loadInsertable,
    versionPath
} from "./load-insertable";

export const ELEMENT_CONCURRENCY = 4;

export interface GroupJob {
    /**
     * The group to load. Its row must already exist — creation (and placement)
     * belong to AddGroup, which inserts a shell row before calling loadGroup.
     */
    groupId: string;
    forceReload: boolean;
    /**
     * The getDocument result, fetched by the caller — which therefore owns the
     * version-skip decision; loadGroup always loads.
     */
    document: OnshapeDocumentInfo;
}

export interface GroupLoadResult {
    loadedElements: number;
    deletedElements: number;
}

/**
 * Syncs an Onshape document into its (existing) group row: plans the element
 * diff, hands each changed element to its own {@link loadInsertable} (which
 * writes its row independently), then deletes orphaned insertables and writes
 * the group row.
 *
 * If any element fails for good, loadGroup throws *without* writing the group
 * row: successes are already committed with fresh microversionIds, and the
 * group's stale versionId queues it for the next sync — which retries only the
 * failed elements.
 */
export async function loadGroup(
    deps: LoadDeps,
    step: WorkflowStep,
    job: GroupJob
): Promise<GroupLoadResult> {
    const { groupId, document } = job;

    const plan = await step.do(`plan-${groupId}`, DATA_RETRIES, () =>
        planGroup(deps, job)
    );
    const { inherited } = plan;

    // Rides uploadThumbnailsWithRetry's budget — durable, runtime-managed
    // delays spread over minutes, since Onshape renders lazily after the first
    // touch. Exhaustion resolves to null (a build issue on the group row).
    const docThumbnails = uploadThumbnailsWithRetry(
        step,
        `doc-thumbnail-${groupId}`,
        async () =>
            uploadDocumentThumbnails(
                deps.env.THUMBNAILS,
                await api(deps),
                versionPath(inherited.documentId, inherited.versionId)
            )
    );

    const toLoad = plan.jobs.filter((insertable) => insertable.needsReload);
    const failedElementIds: string[] = [];
    await mapLimit(toLoad, ELEMENT_CONCURRENCY, async (insertableJob) => {
        try {
            await loadInsertable(deps, step, inherited, insertableJob);
        } catch {
            failedElementIds.push(insertableJob.elementId);
        }
    });

    const docThumbnailUrls = await docThumbnails;

    if (failedElementIds.length > 0) {
        throw new Error(
            `Group ${groupId}: elements failed to load: ` +
                failedElementIds.join(", ")
        );
    }

    await step.do(`write-group-${groupId}`, async () => {
        const db = getDb(deps.env.DB);
        await db.batch(
            buildGroupWriteBatch(
                db,
                inherited,
                document,
                docThumbnailUrls,
                plan.staleInsertableIds
            )
        );
    });

    return {
        loadedElements: toLoad.length,
        deletedElements: plan.staleInsertableIds.length
    };
}

// ---------------------------------------------------------------------------
// Planning — the plan step body, plus its pure core.
// ---------------------------------------------------------------------------

export interface GroupPlan {
    inherited: InheritedProps;
    jobs: PlannedInsertable[];
    /** Rows whose element no longer exists in the document. */
    staleInsertableIds: string[];
}

/**
 * The plan step body: resolves the group's inherited props from its row, then
 * diffs the document's contents against the stored insertables. Freshly minted
 * ids are generated here, inside the memoized step, so they're stable across
 * every replay.
 */
export async function planGroup(
    deps: LoadDeps,
    job: GroupJob
): Promise<GroupPlan> {
    const db = getDb(deps.env.DB);

    const groupRow = await db
        .select({ documentId: group.documentId, libraryId: group.libraryId })
        .from(group)
        .where(eq(group.id, job.groupId))
        .get();
    if (!groupRow) {
        throw new NonRetryableError(
            `Group ${job.groupId} does not exist — loadGroup needs a (shell) row`
        );
    }

    const inherited: InheritedProps = {
        libraryId: groupRow.libraryId,
        groupId: job.groupId,
        documentId: groupRow.documentId,
        versionId: job.document.recentVersion.id
    };

    const contents = await getContents(
        await api(deps),
        versionPath(inherited.documentId, inherited.versionId)
    );
    const { jobs, staleInsertableIds } = planInsertables(
        parseContents(contents),
        await readGroupInsertables(db, job.groupId),
        job.forceReload
    );

    return { inherited, jobs, staleInsertableIds };
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

export interface PlannedInsertable extends InsertableJob {
    needsReload: boolean;
}

export interface GroupInsertablesPlan {
    jobs: PlannedInsertable[];
    staleInsertableIds: string[];
}

/**
 * Pure diff of the Onshape snapshot against the stored rows: which elements to
 * (re)load, which rows to delete, and each element's resolved id.
 */
export function planInsertables(
    snapshot: DocumentSnapshot,
    existing: ExistingInsertable[],
    forceReload: boolean
): GroupInsertablesPlan {
    const existingByElementId = new Map(
        existing.map((row) => [row.elementId, row])
    );
    const sortOrderByElementId = new Map(
        snapshot.orderedTabIds.map((id, index) => [id, index])
    );

    const jobs = snapshot.tabs.map((tab): PlannedInsertable => {
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

    return { jobs, staleInsertableIds };
}

/**
 * The caller-owned skip: a group whose stored versionId already matches the
 * document's latest version is fully loaded, because loadGroup only writes the
 * group row (claiming the versionId) after every element has landed. AddGroup
 * shells carry a placeholder versionId, so an interrupted add is picked up by
 * the next sync instead of being skipped.
 */
export function shouldSkipGroup(
    storedVersionId: string,
    latestVersionId: string,
    forceReload: boolean
): boolean {
    return storedVersionId === latestVersionId && !forceReload;
}

// ---------------------------------------------------------------------------
// The group write — the final step's single atomic batch.
// ---------------------------------------------------------------------------

type GroupRow = typeof group.$inferInsert;
type GroupIdentityColumns = "id" | "documentId" | "libraryId";
/**
 * Extend this if the groups schema grows more user-owned columns — the
 * ReloadedGroupFields annotation below will insist.
 */
type GroupUserOwnedColumns = "sortOrder" | "sortAlphabetically";
export type ReloadedGroupFields = Required<
    Pick<
        GroupRow,
        Exclude<keyof GroupRow, GroupIdentityColumns | GroupUserOwnedColumns>
    >
>;

/**
 * Builds the group's final batch: the group-row update (reload-owned fields
 * only — creation and placement belong to AddGroup) plus the stale-row
 * deletes. Configurations and favorites follow deleted insertables via their
 * cascading foreign keys.
 */
export function buildGroupWriteBatch(
    db: Db,
    inherited: InheritedProps,
    document: OnshapeDocumentInfo,
    docThumbnailUrls: ReloadedGroupFields["thumbnailUrls"],
    staleInsertableIds: string[]
): [Statement, ...Statement[]] {
    const groupFields: ReloadedGroupFields = {
        name: document.name,
        versionId: inherited.versionId,
        thumbnailUrls: docThumbnailUrls,
        buildIssues: checkGroup({
            hasThumbnailTab: !!document.documentThumbnailElementId,
            thumbnailUrls: docThumbnailUrls
        })
    };

    const groupWrite = db
        .update(group)
        .set(groupFields)
        .where(eq(group.id, inherited.groupId));

    if (staleInsertableIds.length === 0) {
        return [groupWrite];
    }
    return [
        groupWrite,
        db
            .delete(insertables)
            .where(inArray(insertables.id, staleInsertableIds))
    ];
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

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
// Pure helpers for the document contents tree.
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
