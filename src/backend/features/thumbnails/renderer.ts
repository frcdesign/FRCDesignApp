/**
 * The one place that asks Onshape to render a configuration.
 *
 * Onshape runs one such render per user at a time. Asking for one it has not
 * got answers 404 and starts rendering it; asking for a *different* one
 * abandons that render and starts the new one. So a caller that interleaves two
 * finishes neither, however long it polls. Onshape does not document this — it
 * is read off renders that either land in under a minute or never.
 *
 * Hence one object per user, and a job that has started rendering holds the
 * render thread: every pass polls that one key until it lands. Only the insert
 * menu may take the thread off a job, since that is the one surface where
 * somebody is watching a particular render happen.
 *
 * An element's own thumbnail does not come through here at all. Onshape renders
 * those when a document is saved, so reading one starts nothing and cannot
 * displace a render in flight — a load fetches them itself, in parallel.
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
    getThumbnailFromId,
    getThumbnailId,
    NoSuchConfigurationError
} from "../../lib/onshape/endpoints/thumbnails";
import { type ConfigurationKey } from "../configurations/contract";
import { PREFERRED_SIZE, RenderSource, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import { putThumbnail } from "./store";

/** A configuration's render, the kind Onshape only does one of at a time. */
export interface ThumbnailRequest {
    /** What the element path is resolved from, since the caller has only this. */
    insertableId: string;
    elementId: string;
    microversionId: string;
    configurationKey: ConfigurationKey;
}

/** Where each source sits in the queue; lower goes first. */
const SOURCE_RANK: Record<RenderSource, number> = {
    [RenderSource.INSERT_MENU]: 0,
    [RenderSource.ROW]: 10,
    [RenderSource.LOAD]: 20
};

/**
 * How often the render holding the thread is asked about, by how long it has
 * held it. Polling the same render does not disturb it, so the first minute —
 * where they normally land — is worth about ten calls. Past that they are
 * outliers, and the backoff stops spending the account's allocation on them.
 */
const POLL_SCHEDULE = [
    { withinMs: 60_000, everyMs: 6_000 },
    { withinMs: 3 * 60_000, everyMs: 20_000 },
    { withinMs: Infinity, everyMs: 60_000 }
] as const;

/**
 * The most thread time one render can ever cost. Well past the two minutes an
 * outlier takes, and hard: a render that reaches it is abandoned rather than
 * retried, so one bad one cannot hold up the queue behind it for longer.
 */
const RENDER_TIMEOUT_MS = 5 * 60_000;

/**
 * Failures before a job is dropped. Being preempted is not one — that is the
 * queue's doing, not the job's.
 */
const MAX_FAILURES = 3;

/** How long a failed job waits before it is worth the thread again. */
const RETRY_DELAY_MS = 30_000;

/** How long a job stays queued; past it a later request asks again. */
const JOB_TTL_MS = 60 * 60_000;

/** Bounds one alarm, not the queue. */
const ALARM_BUDGET_MS = 20_000;

/**
 * Bumped to throw away every queue. A job carries the shape the code that
 * queued it expected, so a deploy that changes that shape leaves work behind
 * which can only fail quietly. Raising this drops it the next time each object
 * is touched.
 */
const QUEUE_GENERATION = 3;

/** A row of the queue, as stored; the index signature is what `sql.exec` reads it as. */
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
    /** Resolved once per job and kept, since it cannot change. */
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
     * Throws away a queue an older deploy left behind. Checked on the way in
     * rather than in the constructor: an object already warm would otherwise
     * keep working its stale queue until something happened to evict it.
     */
    #purgeStaleQueue(): void {
        if (
            this.ctx.storage.kv.get<number>("generation") === QUEUE_GENERATION
        ) {
            return;
        }
        this.ctx.storage.sql.exec("DELETE FROM jobs");
        this.ctx.storage.kv.put("generation", QUEUE_GENERATION);
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
        this.#purgeStaleQueue();

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
     * how far down they are, and how to see what a stalled queue is stalled on.
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
        this.#purgeStaleQueue();
        this.#running = true;
        try {
            await this.#drain();
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
            this.#dropExpired();

            const rendering = this.#renderingJob();
            if (rendering) {
                // Not due yet — and nothing else may run in the meantime, so
                // there is nothing to do but let the alarm come back.
                if (rendering.dueAt > Date.now()) return;
                // Terminal, not a strike. Retrying would take the thread for
                // another five minutes on a render that has already shown it
                // is not coming, with the whole queue waiting behind it.
                if (this.#outOfRenderTime(rendering)) {
                    this.#finish(rendering.key);
                    continue;
                }
                this.#record(rendering, await this.#poll(rendering));
                continue;
            }

            const next = this.#nextQueuedJob();
            if (!next) return;
            this.#record(next, await this.#start(next));
        }
    }

    /**
     * Takes the render thread for a job: checks R2 first, since another caller
     * may have stored these bytes since it was queued, and only then asks
     * Onshape — which is the call that starts the render.
     */
    async #start(job: JobRow): Promise<Attempt> {
        try {
            if (await this.env.BLOB.head(job.key)) {
                return { outcome: "stored" };
            }
            return await this.#fetch(job);
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
            return await this.#fetch(job);
        } catch (error) {
            return classify(error);
        }
    }

    /** The one Onshape call, and the store when it comes back with bytes. */
    async #fetch(job: JobRow): Promise<Attempt> {
        const request = requestOf(job);
        const onshapeApi = await this.#onshapeApi();
        const thumbnail = await getThumbnailFromId(
            onshapeApi,
            await this.#thumbnailId(job, request, onshapeApi),
            sizeOf(job.key)
        );

        await putThumbnail(this.env.BLOB, job.key, thumbnail, {
            microversionId: request.microversionId,
            configurationKey: request.configurationKey
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
        request: ThumbnailRequest,
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

    /** Writes back what one call decided: done, keep polling, or give up. */
    #record(job: JobRow, attempt: Attempt): void {
        switch (attempt.outcome) {
            case "stored":
                this.#finish(job.key);
                return;

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
                return;

            case "rate-limited":
                // The account is being throttled, not this job, so the render
                // keeps its hold: waiting is not the same as switching away.
                this.#delayAll(attempt.retryAfterSeconds * 1000);
                return;

            case "failed":
                // A configuration Onshape has no insertable for, or one that
                // left the library: retrying asks the same question.
                if (attempt.error instanceof NoSuchConfigurationError) {
                    this.#finish(job.key);
                    return;
                }
                this.#fail(job);
                return;
        }
    }

    /** Gives the thread back after a job broke, and drops it once it keeps doing so. */
    #fail(job: JobRow): void {
        if (job.failures + 1 >= MAX_FAILURES) {
            this.#finish(job.key);
            return;
        }
        this.ctx.storage.sql.exec(
            `UPDATE jobs
             SET startedAt = NULL, failures = failures + 1, dueAt = ?
             WHERE key = ?`,
            Date.now() + RETRY_DELAY_MS,
            job.key
        );
    }

    /**
     * Hands the render thread to the insert menu, the only surface that may
     * take it: somebody is watching that render, and the alternative is making
     * them wait out everything else queued.
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

    /** Only a render that actually started can run out of time holding the thread. */
    #outOfRenderTime(job: JobRow): boolean {
        return (
            job.startedAt !== null &&
            Date.now() - job.startedAt > RENDER_TIMEOUT_MS
        );
    }

    /** A render nothing came back for; a later request queues it again. */
    #dropExpired(): void {
        this.ctx.storage.sql.exec(
            "DELETE FROM jobs WHERE expiresAt <= ?",
            Date.now()
        );
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
        const next =
            rendering?.dueAt ??
            this.ctx.storage.sql
                .exec<{
                    dueAt: number | null;
                }>("SELECT MIN(dueAt) AS dueAt FROM jobs")
                .one().dueAt;

        if (next === null || next === undefined) {
            await this.ctx.storage.deleteAlarm();
            return;
        }
        await this.ctx.storage.setAlarm(next);
    }
}

/** A 404 is Onshape rendering in the background, which is the normal case. */
function classify(error: unknown): Attempt {
    if (error instanceof OnshapeRateLimitError) {
        return {
            outcome: "rate-limited",
            retryAfterSeconds: error.retryAfterSeconds
        };
    }
    // A 406 reads the same way: it means Onshape wanted to answer with
    // something the request's Accept header excluded, and the only thing it has
    // to say about a render that is not ready is a JSON error.
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
    return thumbnailKey(
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

/** The size a surface shows first goes first; its other size follows. */
function rankOf(source: RenderSource, size: ThumbnailSize): number {
    return SOURCE_RANK[source] + (size === PREFERRED_SIZE[source] ? 0 : 1);
}

/** How long to wait before asking about a render again; see POLL_SCHEDULE. */
function pollDelay(job: JobRow): number {
    // A job on its first 404 has not been stamped yet, so it reads as zero.
    const heldMs = Date.now() - (job.startedAt ?? Date.now());
    const step = POLL_SCHEDULE.find(({ withinMs }) => heldMs < withinMs);
    // The schedule ends in an unbounded step, so this only satisfies the types.
    return step?.everyMs ?? POLL_SCHEDULE[POLL_SCHEDULE.length - 1].everyMs;
}

/** Who a render runs as: the queue it joins, and the tokens it uses. */
export interface Renderer {
    /** The Onshape user whose one render thread this queue is for. */
    userId: string;
    sessionId: string;
}

/** Queues a render with the object holding this user's Onshape render thread. */
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
