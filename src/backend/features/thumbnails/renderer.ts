/**
 * The one place that asks Onshape for a thumbnail.
 *
 * Onshape runs one thumbnail render per user at a time. Asking for one it has
 * not got answers 404 and starts rendering it; asking for a *different* one
 * abandons that render and starts the new one. So a caller that interleaves two
 * thumbnails finishes neither, however long it polls. Onshape does not document
 * this — it is read off renders that either land in under a minute or never.
 *
 * Hence one object per user, and a job that has started rendering holds the
 * render thread: every pass polls that one key until it lands. Only the insert
 * menu may take the thread off a job, since that is the one surface where
 * somebody is watching a particular render happen.
 */
import { DurableObject } from "cloudflare:workers";
import { HttpStatus } from "http-status-ts";
import { eq } from "drizzle-orm";
import type { AppBindings } from "../../lib/context";
import { getDb } from "../../db/client";
import { insertables } from "../../db/schema";
import {
    OnshapeApiError,
    OnshapeRateLimitError,
    type OnshapeApi
} from "../../lib/onshape/client";
import { getOnshapeApiFromSessionId } from "../auth/request-auth";
import type { ElementPath } from "../../lib/onshape/path";
import {
    getElementThumbnail,
    getThumbnailFromId,
    getThumbnailId,
    NoSuchConfigurationError
} from "../../lib/onshape/endpoints/thumbnails";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY
} from "../configurations/contract";
import { PREFERRED_SIZE, RenderSource, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { putThumbnail, readThumbnailUrls } from "./store";
import { recordThumbnailOutcome, type ThumbnailOwner } from "./record";
import { bumpLibraryVersion } from "../library/db";
import type { LibraryId } from "../library/library-id";

/** An element's own thumbnail, which Onshape renders when the document is saved. */
export interface ElementThumbnailRequest {
    kind: "element";
    /** Where Onshape reads it from; the key comes from its `elementId`. */
    elementPath: ElementPath;
    microversionId: string;
    /**
     * The row to write the urls onto once both sizes land. A load queues these
     * and moves on, so this is what eventually tells it how the render ended.
     */
    owner?: ThumbnailOwner;
}

/** A configuration's render, the kind Onshape only does one of at a time. */
export interface ConfigurationThumbnailRequest {
    kind: "configuration";
    /** What the element path is resolved from, since the caller has only this. */
    insertableId: string;
    elementId: string;
    microversionId: string;
    configurationKey: ConfigurationKey;
}

export type ThumbnailRequest =
    | ElementThumbnailRequest
    | ConfigurationThumbnailRequest;

/** Where each source sits in the queue; lower goes first. */
const SOURCE_RANK: Record<RenderSource, number> = {
    [RenderSource.INSERT_MENU]: 0,
    [RenderSource.ROW]: 10,
    [RenderSource.LOAD]: 20
};

/**
 * How often the render holding the thread is asked about, by how long it has
 * held it. Polling the same thumbnail does not disturb it, so the first minute —
 * where renders normally land — is worth about ten calls. Past that they are
 * outliers, and the backoff stops spending the account's allocation on them.
 */
const POLL_SCHEDULE = [
    { withinMs: 60_000, everyMs: 6_000 },
    { withinMs: 3 * 60_000, everyMs: 20_000 },
    { withinMs: Infinity, everyMs: 60_000 }
] as const;

/**
 * How long one render may hold the thread before the queue takes it back. Well
 * past the two minutes an outlier takes: this is for a render that is never
 * going to land, not for cutting a slow one short.
 */
const RENDER_TIMEOUT_MS = 5 * 60_000;

/**
 * Failures or expired renders before a job is dropped. Being preempted is
 * neither — that is the queue's doing, not the job's.
 */
const MAX_FAILURES = 3;

/** How long a failed job waits before it is worth the thread again. */
const RETRY_DELAY_MS = 30_000;

/**
 * How long a job stays queued. Long because it bounds garbage, not patience:
 * behind a library load the queue is legitimately hours deep, and a render that
 * lands after everyone stopped watching is still stored for the next request.
 */
const JOB_TTL_MS = 6 * 60 * 60_000;

/** Bounds one alarm, not the queue, which a cold load fills with thousands. */
const ALARM_BUDGET_MS = 20_000;

/**
 * How often a library's cache version is bumped while thumbnails land. A cold
 * load finishes hundreds of them, and bumping per thumbnail would throw away
 * every client's cached library that many times.
 */
const BUMP_INTERVAL_MS = 30_000;

/** Libraries with thumbnails recorded since the last bump. */
const BUMP_PREFIX = "bump:";

/** When a bump was last flushed, which is what the interval is measured from. */
const LAST_BUMP_KEY = "lastBumpAt";

/**
 * A row of the queue. It extends `Record` only because `sql.exec` constrains its
 * result type that way, and a TypeScript interface has no implicit index
 * signature to satisfy it with.
 */
interface JobRow extends Record<string, SqlStorageValue> {
    key: string;
    request: string;
    source: string;
    /** Sort order: the source's rank, plus one when this is its second size. */
    queueRank: number;
    /** When this job may next be touched. */
    dueAt: number;
    expiresAt: number;
    failures: number;
    /** Resolved once per configuration job and kept, since it cannot change. */
    thumbnailId: string | null;
    /** When this job took the render thread; null while it is only queued. */
    startedAt: number | null;
}

/** What one call to Onshape came back with, which is all the loop needs. */
type Attempt =
    | { outcome: "stored" }
    /** Onshape is rendering it; this job holds the thread until it lands. */
    | { outcome: "rendering" }
    | { outcome: "failed"; error: unknown }
    /** Everything must wait; Onshape said how long. */
    | { outcome: "rate-limited"; retryAfterSeconds: number };

/** One entry of {@link ThumbnailRenderer.queued}. */
export interface QueuedJob {
    key: string;
    source: string;
    /** Whether this is the job currently holding the render thread. */
    rendering: boolean;
}

/**
 * `#private` rather than the `private` used elsewhere in the codebase, and not
 * as a matter of taste: a Durable Object's prototype methods are its RPC
 * surface, and TypeScript's `private` is erased, so a `private drain()` is
 * callable by anything holding a stub (checked against the runtime, not just
 * the docs). Only `enqueue` and `queued` are meant to be.
 */
export class ThumbnailRenderer extends DurableObject<AppBindings> {
    /**
     * Keeps two alarms from overlapping, which would put two Onshape calls in
     * the air. Whether the runtime already rules that out is not something I
     * could find documented — the input gate is open across non-storage I/O,
     * so an `enqueue` landing mid-drain can set an alarm for now.
     */
    #running = false;

    constructor(ctx: DurableObjectState, env: AppBindings) {
        super(ctx, env);
        // Not under `blockConcurrencyWhile`: SQLite storage is synchronous, so
        // no request can arrive on a half-built schema.
        ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS jobs (
                key TEXT PRIMARY KEY,
                request TEXT NOT NULL,
                source TEXT NOT NULL,
                queueRank INTEGER NOT NULL,
                dueAt INTEGER NOT NULL,
                expiresAt INTEGER NOT NULL,
                failures INTEGER NOT NULL DEFAULT 0,
                thumbnailId TEXT,
                startedAt INTEGER
            );
            CREATE INDEX IF NOT EXISTS jobs_queue ON jobs (queueRank, dueAt);
        `);
    }

    /**
     * Queues both sizes and returns; callers read the bytes back out of R2.
     *
     * A job is named by the R2 key it will write, so asking twice is asking
     * once and a client may poll as fast as it likes. A repeat does refresh the
     * session and improve the rank, but never moves the next attempt earlier —
     * that is what let a polling client reset a render's backoff endlessly.
     */
    async enqueue(
        request: ThumbnailRequest,
        sessionId: string,
        source: RenderSource
    ): Promise<void> {
        const now = Date.now();
        // Any live session for this user can render any of these jobs, so the
        // newest one wins — which is what keeps a job queued under a session
        // that has since expired renderable.
        this.ctx.storage.kv.put("sessionId", sessionId);

        const keys = [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) => {
            const key = keyOf(request, size);
            this.ctx.storage.sql.exec(
                `INSERT INTO jobs
                     (key, request, source, queueRank, dueAt, expiresAt)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT (key) DO UPDATE SET
                     source = CASE WHEN excluded.queueRank < jobs.queueRank
                                   THEN excluded.source ELSE jobs.source END,
                     queueRank = MIN(jobs.queueRank, excluded.queueRank)`,
                key,
                JSON.stringify(request),
                source,
                rankOf(source, size),
                now,
                now + JOB_TTL_MS
            );
            return key;
        });

        if (source === RenderSource.INSERT_MENU) {
            this.#preemptFor(keys);
        }
        await this.#scheduleNext();
    }

    /**
     * The queue in the order it will run, the held render first. Exposed
     * because the order is what this object is for: it is how to tell someone
     * how far down they are, and how to see what a stalled load is stalled on.
     */
    queued(): QueuedJob[] {
        return this.ctx.storage.sql
            .exec<JobRow>(
                `SELECT * FROM jobs
                 ORDER BY startedAt IS NULL, queueRank, dueAt`
            )
            .toArray()
            .map((job) => ({
                key: job.key,
                source: job.source,
                rendering: job.startedAt !== null
            }));
    }

    async alarm(): Promise<void> {
        if (this.#running) return;
        this.#running = true;
        try {
            await this.#drain();
            await this.#flushBumps();
        } finally {
            this.#running = false;
            await this.#scheduleNext();
        }
    }

    /**
     * One Onshape call per pass. While a job holds the render thread every pass
     * polls that one key — asking about anything else abandons its render.
     */
    async #drain(): Promise<void> {
        const until = Date.now() + ALARM_BUDGET_MS;

        while (Date.now() < until) {
            await this.#dropExpired();

            const rendering = this.#renderingJob();
            if (rendering) {
                // Not due yet — and nothing else may run in the meantime, so
                // there is nothing to do but let the alarm come back.
                if (rendering.dueAt > Date.now()) return;
                if (this.#outOfRenderTime(rendering)) {
                    this.#fail(rendering);
                    continue;
                }
                await this.#attempt(rendering, await this.#poll(rendering));
                continue;
            }

            const next = this.#nextQueuedJob();
            if (!next) return;
            await this.#attempt(next, await this.#start(next));
        }
    }

    /**
     * Writes back what the attempt decided, and tells the row that asked for it
     * once the pair is settled either way.
     */
    async #attempt(job: JobRow, attempt: Attempt): Promise<void> {
        const gone = this.#record(job, attempt);
        if (gone) {
            await this.#reportOutcome(job);
        }
    }

    /**
     * Reports a finished thumbnail to whatever queued it. Both sizes are one
     * pair of columns, so it waits for the second: the first to land finds the
     * other missing and leaves the row alone.
     */
    async #reportOutcome(job: JobRow): Promise<void> {
        const request = requestOf(job);
        if (request.kind !== "element" || !request.owner) {
            return;
        }
        const urls = await readThumbnailUrls(
            this.env.BLOB,
            request.elementPath.elementId,
            request.microversionId
        );
        // Nothing stored and a sibling still queued: the pair is not settled,
        // so there is nothing to say yet.
        if (!urls && this.#hasSibling(job)) {
            return;
        }

        const recorded = await recordThumbnailOutcome(
            getDb(this.env.DB),
            request.owner,
            urls ? { stored: true, urls } : { stored: false }
        );
        if (recorded) {
            this.ctx.storage.kv.put(
                `${BUMP_PREFIX}${request.owner.libraryId}`,
                true
            );
        }
    }

    /** Whether the other size of this request is still queued. */
    #hasSibling(job: JobRow): boolean {
        return (
            this.ctx.storage.sql
                .exec<{
                    count: number;
                }>(
                    "SELECT COUNT(*) AS count FROM jobs WHERE request = ?",
                    job.request
                )
                .one().count > 0
        );
    }

    /**
     * Bumps the libraries whose thumbnails have landed, at most once an
     * interval. Clients hold the library payload by cache version, so this is
     * what puts the new urls in front of them.
     */
    async #flushBumps(): Promise<void> {
        const dueAt = this.#bumpDueAt();
        if (dueAt === undefined || dueAt > Date.now()) {
            return;
        }
        const db = getDb(this.env.DB);
        for (const key of this.#pendingBumps()) {
            await bumpLibraryVersion(
                db,
                key.slice(BUMP_PREFIX.length) as LibraryId
            );
            this.ctx.storage.kv.delete(key);
        }
        this.ctx.storage.kv.put(LAST_BUMP_KEY, Date.now());
    }

    /** When the pending bumps may next flush, or undefined when there are none. */
    #bumpDueAt(): number | undefined {
        if (this.#pendingBumps().length === 0) return undefined;
        const last = this.ctx.storage.kv.get<number>(LAST_BUMP_KEY) ?? 0;
        return last + BUMP_INTERVAL_MS;
    }

    #pendingBumps(): string[] {
        return [...this.ctx.storage.kv.list({ prefix: BUMP_PREFIX })].map(
            ([key]) => key
        );
    }

    /**
     * Takes the render thread. R2 is checked first because another load or an
     * earlier pass may have stored these bytes since the job was queued; the
     * Onshape call that follows is what starts the render.
     */
    async #start(job: JobRow): Promise<Attempt> {
        try {
            if (await this.env.BLOB.head(job.key)) {
                return { outcome: "stored" };
            }

            const request = requestOf(job);
            const onshapeApi = await this.#onshapeApi();
            const thumbnailId =
                request.kind === "configuration"
                    ? await this.#thumbnailId(job, request, onshapeApi)
                    : undefined;

            return await this.#fetch(job, request, onshapeApi, thumbnailId);
        } catch (error) {
            return classify(error);
        }
    }

    /**
     * Asks again about the render this job started. No R2 check — these bytes
     * arrive only by way of this call, so looking first answers nothing.
     */
    async #poll(job: JobRow): Promise<Attempt> {
        try {
            return await this.#fetch(
                job,
                requestOf(job),
                await this.#onshapeApi(),
                job.thumbnailId ?? undefined
            );
        } catch (error) {
            return classify(error);
        }
    }

    /** The one Onshape call, and the store when it comes back with bytes. */
    async #fetch(
        job: JobRow,
        request: ThumbnailRequest,
        onshapeApi: OnshapeApi,
        thumbnailId: string | undefined
    ): Promise<Attempt> {
        const size = sizeOf(job.key);
        let thumbnail: ArrayBuffer;
        if (request.kind === "element") {
            thumbnail = await getElementThumbnail(
                onshapeApi,
                request.elementPath,
                size
            );
        } else {
            if (!thumbnailId) {
                throw new Error(`No thumbnail id resolved for ${job.key}`);
            }
            thumbnail = await getThumbnailFromId(onshapeApi, thumbnailId, size);
        }

        await putThumbnail(this.env.BLOB, job.key, thumbnail, {
            microversionId: request.microversionId,
            configurationKey:
                request.kind === "configuration"
                    ? request.configurationKey
                    : DEFAULT_CONFIGURATION_KEY
        });
        return { outcome: "stored" };
    }

    /**
     * The render's id, written to both sizes at once: it is fixed for an
     * element and configuration, so asking per size or per poll only spends a
     * call to be told the same thing.
     */
    async #thumbnailId(
        job: JobRow,
        request: ConfigurationThumbnailRequest,
        onshapeApi: OnshapeApi
    ): Promise<string> {
        if (job.thumbnailId) return job.thumbnailId;

        const elementPath = await this.#elementPath(request.insertableId);
        const thumbnailId = await getThumbnailId(
            onshapeApi,
            elementPath,
            request.configurationKey
        );
        this.ctx.storage.sql.exec(
            "UPDATE jobs SET thumbnailId = ? WHERE request = ?",
            thumbnailId,
            job.request
        );
        return thumbnailId;
    }

    /** Read rather than passed in: a request can carry a version it has moved past. */
    async #elementPath(insertableId: string): Promise<ElementPath> {
        const row = await getDb(this.env.DB)
            .select({
                documentId: insertables.documentId,
                versionId: insertables.versionId,
                elementId: insertables.elementId
            })
            .from(insertables)
            .where(eq(insertables.id, insertableId))
            .get();
        if (!row) {
            throw new NoSuchConfigurationError(`No insertable ${insertableId}`);
        }
        return {
            documentId: row.documentId,
            instanceId: row.versionId,
            instanceType: "v",
            elementId: row.elementId
        };
    }

    async #onshapeApi(): Promise<OnshapeApi> {
        const sessionId = this.ctx.storage.kv.get<string>("sessionId");
        if (!sessionId) {
            throw new Error("No session to render under");
        }
        return getOnshapeApiFromSessionId(this.env.KV, sessionId);
    }

    /**
     * Writes back what one call decided: done, keep polling, or give up.
     * Returns whether the job left the queue, settled one way or the other.
     */
    #record(job: JobRow, attempt: Attempt): boolean {
        switch (attempt.outcome) {
            case "stored":
                this.#finish(job.key);
                return true;

            case "rendering":
                // Takes the thread: nothing else may be asked of Onshape until
                // this lands, or Onshape abandons it.
                this.ctx.storage.sql.exec(
                    `UPDATE jobs
                     SET startedAt = COALESCE(startedAt, ?), dueAt = ?
                     WHERE key = ?`,
                    Date.now(),
                    Date.now() + pollDelay(job),
                    job.key
                );
                return false;

            case "rate-limited":
                // The account is being throttled, not this job, so the render
                // keeps its hold: waiting is not the same as switching away.
                this.#delayAll(attempt.retryAfterSeconds * 1000);
                return false;

            case "failed":
                // A configuration Onshape has no insertable for, or one that
                // left the library: retrying asks the same question.
                if (attempt.error instanceof NoSuchConfigurationError) {
                    this.#finish(job.key);
                    return true;
                }
                return this.#fail(job);
        }
    }

    /**
     * Gives the thread back after a job broke, and drops it once it keeps doing
     * so. Returns whether it was dropped, which settles it as a failure.
     */
    #fail(job: JobRow): boolean {
        if (job.failures + 1 >= MAX_FAILURES) {
            this.#finish(job.key);
            return true;
        }
        this.ctx.storage.sql.exec(
            `UPDATE jobs
             SET startedAt = NULL, failures = failures + 1, dueAt = ?
             WHERE key = ?`,
            Date.now() + RETRY_DELAY_MS,
            job.key
        );
        return false;
    }

    /**
     * Hands the render thread to the insert menu, the only surface that may
     * take it: somebody is watching that render, and the alternative is making
     * them wait out a library load.
     *
     * The job that loses it is requeued rather than dropped — its render is
     * gone, so it starts over at its turn. `dueAt` moves to now, putting it
     * behind its waiting siblings, which is also what stops a user flipping
     * between two configurations from bouncing one pair forever.
     */
    #preemptFor(keys: string[]): void {
        const rendering = this.#renderingJob();
        // The insert menu polling its own render must not interrupt it, which
        // is the exact thrash this all exists to avoid.
        if (!rendering || keys.includes(rendering.key)) {
            return;
        }
        this.ctx.storage.sql.exec(
            "UPDATE jobs SET startedAt = NULL, dueAt = ? WHERE key = ?",
            Date.now(),
            rendering.key
        );
    }

    #finish(key: string): void {
        this.ctx.storage.sql.exec("DELETE FROM jobs WHERE key = ?", key);
    }

    /** The job holding the render thread, if one does. */
    #renderingJob(): JobRow | undefined {
        return this.ctx.storage.sql
            .exec<JobRow>("SELECT * FROM jobs WHERE startedAt IS NOT NULL")
            .toArray()[0];
    }

    #nextQueuedJob(): JobRow | undefined {
        return this.ctx.storage.sql
            .exec<JobRow>(
                `SELECT * FROM jobs WHERE startedAt IS NULL AND dueAt <= ?
                 ORDER BY queueRank, dueAt LIMIT 1`,
                Date.now()
            )
            .toArray()[0];
    }

    #outOfRenderTime(job: JobRow): boolean {
        return Date.now() - (job.startedAt ?? 0) > RENDER_TIMEOUT_MS;
    }

    /**
     * A job nothing came back for. Its owner is told, or a row queued by a load
     * would say "still rendering" for good; a later request queues it again.
     */
    async #dropExpired(): Promise<void> {
        const expired = this.ctx.storage.sql
            .exec<JobRow>("SELECT * FROM jobs WHERE expiresAt <= ?", Date.now())
            .toArray();
        for (const job of expired) {
            this.#finish(job.key);
            await this.#reportOutcome(job);
        }
    }

    #delayAll(delayMs: number): void {
        this.ctx.storage.sql.exec(
            "UPDATE jobs SET dueAt = MAX(dueAt, ?)",
            Date.now() + delayMs
        );
    }

    /**
     * Wakes for the next thing that can actually run. While a job holds the
     * thread that is its next poll: waking for a queued job whose turn cannot
     * come would spin the alarm against a due time already in the past.
     */
    async #scheduleNext(): Promise<void> {
        const rendering = this.#renderingJob();
        const queued =
            rendering?.dueAt ??
            this.ctx.storage.sql
                .exec<{
                    dueAt: number | null;
                }>("SELECT MIN(dueAt) AS dueAt FROM jobs")
                .one().dueAt;

        // A pending bump has to wake the object too, or a queue that empties
        // leaves the last thumbnails recorded but invisible to clients.
        const wakeAt = [queued, this.#bumpDueAt()].filter(
            (at): at is number => at !== null && at !== undefined
        );
        if (wakeAt.length === 0) {
            await this.ctx.storage.deleteAlarm();
            return;
        }
        await this.ctx.storage.setAlarm(Math.min(...wakeAt));
    }
}

/**
 * A 404 is Onshape rendering in the background, which is the normal case.
 *
 * So is a 406, as best I can tell: it means Onshape wanted to answer with
 * something the request's Accept header excluded, and the only thing it has to
 * say about a thumbnail that is not ready is a JSON error. `getImage` accepts
 * any media type to stop that happening, but reading a 406 as a hard failure
 * would drop a job over a render that was only slow, so it is read the same.
 */
function classify(error: unknown): Attempt {
    if (error instanceof OnshapeRateLimitError) {
        return {
            outcome: "rate-limited",
            retryAfterSeconds: error.retryAfterSeconds
        };
    }
    if (
        error instanceof OnshapeApiError &&
        (error.status === HttpStatus.NOT_FOUND ||
            error.status === HttpStatus.NOT_ACCEPTABLE)
    ) {
        return { outcome: "rendering" };
    }
    return { outcome: "failed", error };
}

function requestOf(job: JobRow): ThumbnailRequest {
    return JSON.parse(job.request) as ThumbnailRequest;
}

/** The R2 key a request writes at one size, which is also the job's name. */
function keyOf(request: ThumbnailRequest, size: ThumbnailSize): string {
    return request.kind === "element"
        ? thumbnailKey(
              request.elementPath.elementId,
              request.microversionId,
              size
          )
        : thumbnailKey(
              request.elementId,
              request.microversionId,
              size,
              request.configurationKey
          );
}

/** Every key ends in the size it stores; see `thumbnailKey`. */
function sizeOf(key: string): ThumbnailSize {
    return key.slice(key.lastIndexOf("/") + 1) as ThumbnailSize;
}

/** How long to wait before asking about a render again; see POLL_SCHEDULE. */
function pollDelay(job: JobRow): number {
    // A job on its first 404 has not been stamped yet, so it reads as zero.
    const heldMs = Date.now() - (job.startedAt ?? Date.now());
    const step = POLL_SCHEDULE.find(({ withinMs }) => heldMs < withinMs);
    // The schedule ends in an unbounded step, so this only satisfies the types.
    return step?.everyMs ?? POLL_SCHEDULE[POLL_SCHEDULE.length - 1].everyMs;
}

/** The size a surface shows first goes first; its other size follows. */
function rankOf(source: RenderSource, size: ThumbnailSize): number {
    return SOURCE_RANK[source] + (size === PREFERRED_SIZE[source] ? 0 : 1);
}

/** Who a render runs as: the queue it joins, and the tokens it uses. */
export interface Renderer {
    /** The Onshape user whose one render thread this queue is for. */
    userId: string;
    sessionId: string;
}

/** Queues a thumbnail with the object holding this user's Onshape render thread. */
export function requestThumbnails(
    env: AppBindings,
    { userId, sessionId }: Renderer,
    request: ThumbnailRequest,
    source: RenderSource
): Promise<void> {
    return env.THUMBNAIL_RENDERER.getByName(userId).enqueue(
        request,
        sessionId,
        source
    );
}
