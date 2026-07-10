import type { WorkflowStep } from "cloudflare:workers";
import type { BatchItem } from "drizzle-orm/batch";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../app";
import { getOnshapeApiForSessionId } from "../auth";
import { type Db, getDb } from "../db";
import type { ElementPath, InstancePath } from "../../shared/onshape-path";
import type { ParameterObj } from "../../shared/configuration-models";
import type {
    ElementType,
    FastenInfo,
    LibraryId,
    ThumbnailUrls,
    Vendor
} from "../../shared/types";
import { configurations, insertables } from "../../shared/schema";
import {
    uploadThumbnails,
    uploadThumbnailsWithRetry
} from "../routes/thumbnails";
import { getConfiguration } from "../onshape-api/endpoints/configurations";
import type { OnshapeApi } from "../onshape-api/onshape-api";
import { checkInsertable } from "../parse/build-checks";
import { parseOnshapeConfiguration } from "../parse/parse-configuration";
import { parseVendors } from "../parse/parse-vendors";
import { parseFastenInfo } from "../parse/insert-and-fasten";

export interface LoadDeps {
    env: AppBindings;
    sessionId: string;
}

export const DATA_RETRIES = {
    retries: { limit: 3, delay: "5 seconds", backoff: "exponential" }
} as const;

/**
 * The group-scoped fields every insertable inherits — built by loadGroup and
 * passed down in memory, never read back from a half-written group row.
 */
export interface InheritedProps {
    libraryId: LibraryId;
    groupId: string;
    documentId: string;
    versionId: string;
}

/**
 * One element to load, with its identity already resolved by loadGroup's plan
 * step: the row's id (freshly minted for a new element, inside the memoized
 * step so it's replay-stable) and the stored fields the load consults.
 */
export interface InsertableJob {
    insertableId: string;
    elementId: string;
    name: string;
    elementType: ElementType;
    /** The element's new microversion, written on save. */
    microversionId: string;
    /** Tab-order position. Seeds sortOrder on insert; never touched on reload. */
    sortOrder: number;
    isNew: boolean;
    /** Stored insert-and-fasten preference — gates re-parsing fasten info. */
    supportsFasten: boolean;
}

/**
 * Loads and persists a single insertable, independent of every other element
 * in its group. Each stage is its own memoized step, and the row (plus its
 * configuration) is written once at the end — so a permanent failure leaves
 * the stored microversionId stale, which queues just this element for the
 * next reload of its group.
 */
export async function loadInsertable(
    deps: LoadDeps,
    step: WorkflowStep,
    inherited: InheritedProps,
    job: InsertableJob
): Promise<void> {
    const { insertableId } = job;
    const path = elementPathOf(inherited, job.elementId);

    // Thumbnail steps ride uploadThumbnailsWithRetry's budget — durable,
    // runtime-managed delays spread over minutes, since Onshape renders lazily
    // after the first touch. Exhaustion resolves to null (a build issue on the
    // row); it never fails the element.
    const thumbnails = uploadThumbnailsWithRetry(
        step,
        `thumbnail-${insertableId}`,
        async () =>
            uploadThumbnails(
                deps.env.THUMBNAILS,
                await api(deps),
                path,
                job.microversionId
            )
    );

    let data: InsertableData;
    try {
        data = await loadInsertableData(deps, step, job, path);
    } catch (error) {
        // Let the pending thumbnail ladder settle before failing the element,
        // so no step is left running when the caller handles the failure.
        await thumbnails;
        throw error;
    }

    const reloaded = buildReloadedFields(
        inherited,
        job,
        data,
        await thumbnails
    );
    await step.do(`save-${insertableId}`, async () => {
        const db = getDb(deps.env.DB);
        await db.batch(
            buildSaveBatch(db, inherited, job, reloaded, data.parameters)
        );
    });
}

/** The required per-element data — everything except the thumbnail. */
export interface InsertableData {
    parameters: ParameterObj[] | null;
    vendors: Vendor[];
    fastenInfo: FastenInfo | null;
}

/**
 * The element's required fetches, one step each. A failure here fails the
 * element (once retries are exhausted) — configuration and fasten info are
 * required.
 */
async function loadInsertableData(
    deps: LoadDeps,
    step: WorkflowStep,
    job: InsertableJob,
    path: ElementPath
): Promise<InsertableData> {
    const parameters = await step.do(
        `config-${job.insertableId}`,
        DATA_RETRIES,
        async () => {
            const rawConfig = await getConfiguration(await api(deps), path);
            return rawConfig.configurationParameters.length === 0
                ? null
                : parseOnshapeConfiguration(rawConfig).parameters;
        }
    );

    const vendors = parseVendors(
        job.name,
        parameters ? { parameters } : undefined
    );

    // Never parsed for a brand-new element; gated by the stored preference on
    // reload — same semantics as before.
    const fastenInfo =
        !job.isNew && job.supportsFasten
            ? await step.do(
                  `fasten-${job.insertableId}`,
                  DATA_RETRIES,
                  async () =>
                      parseFastenInfo(await api(deps), path, job.elementType)
              )
            : null;

    return { parameters, vendors, fastenInfo };
}

/** Joins the element's data and thumbnails into its reload-owned fields. */
export function buildReloadedFields(
    inherited: InheritedProps,
    job: InsertableJob,
    data: InsertableData,
    thumbnailUrls: ThumbnailUrls | null
): ReloadedFields {
    return {
        name: job.name,
        elementType: job.elementType,
        microversionId: job.microversionId,
        versionId: inherited.versionId,
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

/** Owned by the user after creation. */
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

function identityFields(
    inherited: InheritedProps,
    job: InsertableJob
): IdentityFields {
    return {
        id: job.insertableId,
        libraryId: inherited.libraryId,
        groupId: inherited.groupId,
        documentId: inherited.documentId,
        elementId: job.elementId
    };
}

/**
 * The user-owned columns' new-row seeds. On an existing row the upsert
 * discards these (its conflict set omits them), so they only ever land when
 * the row is first inserted — that is the preservation guarantee.
 */
function newRowUserFields(job: InsertableJob): UserOwnedFields {
    return {
        // Seeded from the tab-manager position; the user owns ordering after.
        sortOrder: job.sortOrder,
        // Keep these two literals in sync with the schema column defaults.
        isVisible: true,
        isOpenComposite: false,
        // The stored preference (always false for a brand-new element).
        supportsFasten: job.supportsFasten
    };
}

/** A complete row for the upsert's VALUES: identity + user seeds + reloaded. */
export function buildInsertableRow(
    inherited: InheritedProps,
    job: InsertableJob,
    reloaded: ReloadedFields
): InsertableRow {
    return {
        ...identityFields(inherited, job),
        ...newRowUserFields(job),
        ...reloaded
    };
}

export type Statement = BatchItem<"sqlite">;

/**
 * The element's single atomic batch: an insertable upsert (create and replay
 * converge on one statement; the conflict set is exactly the reload-owned
 * fields) plus the configuration row's upsert or delete. Exported so tests
 * can apply it twice and assert that replays converge.
 */
export function buildSaveBatch(
    db: Db,
    inherited: InheritedProps,
    job: InsertableJob,
    reloaded: ReloadedFields,
    parameters: ParameterObj[] | null
): [Statement, ...Statement[]] {
    const insertableWrite = db
        .insert(insertables)
        .values(buildInsertableRow(inherited, job, reloaded))
        .onConflictDoUpdate({
            target: [insertables.groupId, insertables.elementId],
            set: reloaded
        });

    if (parameters !== null) {
        return [
            insertableWrite,
            db
                .insert(configurations)
                .values({ id: job.insertableId, parameters })
                .onConflictDoUpdate({
                    target: configurations.id,
                    set: { parameters }
                })
        ];
    }
    // The element no longer has a configuration — drop the stale row rather
    // than leaking it.
    if (!job.isNew) {
        return [
            insertableWrite,
            db
                .delete(configurations)
                .where(eq(configurations.id, job.insertableId))
        ];
    }
    return [insertableWrite];
}

// ---------------------------------------------------------------------------
// Shared plumbing for the load pipeline.
// ---------------------------------------------------------------------------

/** Resolved fresh per step body, so replays after a token refresh stay valid. */
export function api(deps: LoadDeps): Promise<OnshapeApi> {
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
