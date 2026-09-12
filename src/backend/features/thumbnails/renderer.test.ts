import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { resetDb, seedGroup, TEST_LIBRARY_ID } from "../../../__test_utils__";
import {
    insertableTarget,
    parsedInsertable
} from "../../../__test_utils__/insertable-fixtures";
import { saveInsertable } from "../load/load-insertable";
import * as ThumbnailEndpoints from "../../lib/onshape/endpoints/thumbnails";
import {
    OnshapeApiError,
    OnshapeRateLimitError
} from "../../lib/onshape/client";
import { insertables, libraries } from "../../db/schema";
import { BuildIssueType } from "../build-checker/issues";
import { RenderSource, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import type { ThumbnailRequest } from "./renderer";

const MICROVERSION = "mv-1";
const SESSION_ID = "renderer-session";
const CONFIGURATION = "size=l";

const ELEMENT_PATH = {
    documentId: "d1",
    instanceId: "v1",
    instanceType: "v" as const,
    elementId: "e1"
};

/**
 * A fresh object and a fresh element per test: the queue is per object, but R2
 * is one bucket, and a key another test stored is a key this one skips.
 */
let testId = "";
const renderer = () => env.THUMBNAIL_RENDERER.getByName(testId);
const elementIdFor = (name: string) => `${testId}-${name}`;

const elementRequest = (name = "e"): ThumbnailRequest => ({
    kind: "element",
    elementPath: { ...ELEMENT_PATH, elementId: elementIdFor(name) },
    microversionId: MICROVERSION
});

const keyFor = (name: string, size: ThumbnailSize) =>
    thumbnailKey(elementIdFor(name), MICROVERSION, size);

const bothKeys = (name: string) =>
    [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) =>
        keyFor(name, size)
    );

/** Stands in for a session, which is what the renderer resolves tokens from. */
async function seedSession() {
    await env.KV.put(
        `tokens:${SESSION_ID}`,
        JSON.stringify({
            accessToken: "token",
            refreshToken: "refresh",
            expiresAt: Date.now() + 3_600_000,
            userId: "renderer-user"
        })
    );
}

/** Onshape's answer per element: bytes, or the 404 that means "still rendering". */
function mockRenders(
    answer: (elementId: string, size: ThumbnailSize) => Promise<ArrayBuffer>
) {
    return vi
        .spyOn(ThumbnailEndpoints, "getElementThumbnail")
        .mockImplementation((_client, path, size) =>
            answer(path.elementId, size ?? ThumbnailSize.LARGE)
        );
}

const stillRendering = () =>
    Promise.reject(new OnshapeApiError("Onshape API error 404: nope", 404));

const notAcceptable = () =>
    Promise.reject(new OnshapeApiError("Onshape API error 406: nope", 406));

const rendered = () => Promise.resolve(new ArrayBuffer(4));

/**
 * For tests that only read the queue's order. It keeps jobs queued — a 404 is
 * "rendering" and would take the thread, which sorts that job first — and keeps
 * the runtime from reaching the real Onshape while they look.
 */
const notAsked = () => Promise.reject(new Error("not asked in this test"));

/**
 * Drives the queue with its own alarm until `reached` holds, without waiting on
 * wall time. Enqueuing schedules an alarm for now, so the runtime may already
 * be draining; each pass yields, which lets one in flight finish, and runs the
 * next alarm if one is scheduled.
 *
 * Deliberately no timers. The pool runs files in parallel and promises nothing
 * about how long a drain takes, so anything paced by the clock is both slower
 * and a coin toss.
 */
async function drainUntil(
    reached: () => boolean | Promise<boolean>
): Promise<void> {
    for (let pass = 0; pass < 50; pass++) {
        if (await reached()) return;
        await runDurableObjectAlarm(renderer());
    }
    throw new Error("the renderer never reached the expected state");
}

/** Runs several more alarms, so "nothing changed" means it had the chance to. */
async function settle(): Promise<void> {
    for (let pass = 0; pass < 5; pass++) {
        await runDurableObjectAlarm(renderer());
    }
}

/** The key holding the render thread, once one does. */
async function renderingKey(): Promise<string> {
    await drainUntil(async () =>
        (await renderer().queued()).some((job) => job.rendering)
    );
    const jobs = await renderer().queued();
    return jobs.find((job) => job.rendering)!.key;
}

/** The soonest any job may next be touched. */
async function soonestDueAt(): Promise<number> {
    return runInDurableObject(
        renderer(),
        (_instance, state) =>
            state.storage.sql
                .exec<{
                    dueAt: number | null;
                }>("SELECT MIN(dueAt) AS dueAt FROM jobs")
                .one().dueAt ?? 0
    );
}

async function queueOf(count: number) {
    await drainUntil(async () => (await renderer().queued()).length === count);
    return renderer().queued();
}

/** What Onshape was asked about this test's element, in order. */
function callsFor(
    calls: ReturnType<typeof mockRenders>,
    name: string
): unknown[] {
    return calls.mock.calls.filter(
        (call) => call[1].elementId === elementIdFor(name)
    );
}

describe("ThumbnailRenderer", () => {
    beforeEach(async () => {
        testId = `t${crypto.randomUUID()}`;
        await seedSession();
    });

    afterEach(() => vi.restoreAllMocks());

    it("queues both sizes of one request", async () => {
        await renderer().enqueue(
            elementRequest(),
            SESSION_ID,
            RenderSource.LOAD
        );

        expect((await renderer().queued()).map((job) => job.key)).toEqual(
            expect.arrayContaining(bothKeys("e"))
        );
    });

    // A client polls the route, and every poll re-enqueues; without this the
    // queue would grow a job per poll.
    it("names a job by its key, so enqueuing twice enqueues once", async () => {
        await renderer().enqueue(
            elementRequest(),
            SESSION_ID,
            RenderSource.LOAD
        );
        await renderer().enqueue(
            elementRequest(),
            SESSION_ID,
            RenderSource.LOAD
        );

        expect(await renderer().queued()).toHaveLength(2);
    });

    it("stores what Onshape rendered and drops the job", async () => {
        mockRenders(rendered);
        await renderer().enqueue(
            elementRequest(),
            SESSION_ID,
            RenderSource.LOAD
        );

        expect(await queueOf(0)).toEqual([]);
        for (const key of bothKeys("e")) {
            expect(await env.BLOB.head(key)).not.toBeNull();
        }
    });

    // The whole point of the object: asking Onshape for a different thumbnail
    // abandons the render in flight, so a job that has started one is polled to
    // the exclusion of everything else.
    it("holds the render thread until its own render lands", async () => {
        const calls = mockRenders((elementId) =>
            elementId === elementIdFor("first") ? stillRendering() : rendered()
        );
        await renderer().enqueue(
            elementRequest("first"),
            SESSION_ID,
            RenderSource.LOAD
        );
        await renderer().enqueue(
            elementRequest("second"),
            SESSION_ID,
            RenderSource.LOAD
        );

        const held = await renderingKey();
        // More passes, so "never asked about" means the queue had every chance
        // to ask and did not.
        await settle();

        expect(held).toContain(elementIdFor("first"));
        // The job behind it was due the whole time and never asked about:
        // asking would have abandoned the render in flight.
        expect(callsFor(calls, "second")).toEqual([]);
    });

    // Nobody is waiting on any one thumbnail of a load, so it yields to the
    // configuration someone is watching a spinner for.
    it("runs what someone is watching before what a load queued", async () => {
        mockRenders(notAsked);
        await renderer().enqueue(
            elementRequest("loaded"),
            SESSION_ID,
            RenderSource.LOAD
        );
        await renderer().enqueue(
            elementRequest("watched"),
            SESSION_ID,
            RenderSource.ROW
        );

        const queued = await renderer().queued();
        expect(
            queued.slice(0, 2).every((job) => job.key.includes("watched"))
        ).toBe(true);
    });

    // A row shows the small one and reveals the large on hover; the insert menu
    // shows only the large. They are separate renders, and only one may run.
    it("runs the size its surface shows first", async () => {
        mockRenders(notAsked);
        await renderer().enqueue(
            elementRequest("row"),
            SESSION_ID,
            RenderSource.ROW
        );
        expect((await renderer().queued())[0].key).toBe(
            keyFor("row", ThumbnailSize.SMALL)
        );

        testId = `t${crypto.randomUUID()}`;
        await renderer().enqueue(
            elementRequest("menu"),
            SESSION_ID,
            RenderSource.INSERT_MENU
        );
        expect((await renderer().queued())[0].key).toBe(
            keyFor("menu", ThumbnailSize.LARGE)
        );
    });

    // Somebody is watching this one render; the alternative is making them wait
    // out a library load.
    it("takes the render thread for the insert menu", async () => {
        mockRenders(stillRendering);
        await renderer().enqueue(
            elementRequest("loaded"),
            SESSION_ID,
            RenderSource.LOAD
        );
        expect(await renderingKey()).toContain(elementIdFor("loaded"));

        await renderer().enqueue(
            elementRequest("watched"),
            SESSION_ID,
            RenderSource.INSERT_MENU
        );

        await drainUntil(async () =>
            (await renderer().queued()).some(
                (job) =>
                    job.rendering && job.key.includes(elementIdFor("watched"))
            )
        );
        // The load's render is gone, not its job: it starts over when its turn
        // comes round again.
        expect((await renderer().queued()).map((job) => job.key)).toEqual(
            expect.arrayContaining(bothKeys("loaded"))
        );
    });

    // The insert menu polls its own render every couple of seconds. Treating
    // that as a reason to restart it is the exact thrash this all prevents.
    it("does not interrupt the render the insert menu is waiting on", async () => {
        mockRenders(stillRendering);
        await renderer().enqueue(
            elementRequest("watched"),
            SESSION_ID,
            RenderSource.INSERT_MENU
        );
        const held = await renderingKey();

        await renderer().enqueue(
            elementRequest("watched"),
            SESSION_ID,
            RenderSource.INSERT_MENU
        );

        await runInDurableObject(renderer(), (_instance, state) => {
            const started = state.storage.sql
                .exec<{
                    key: string;
                }>("SELECT key FROM jobs WHERE startedAt IS NOT NULL")
                .toArray();
            expect(started).toHaveLength(1);
            expect(started[0].key).toBe(held);
        });
    });

    // A render an earlier load already stored, or the other size of a pair.
    it("checks R2 before taking the thread, not on every poll", async () => {
        for (const key of bothKeys("stored")) {
            await env.BLOB.put(key, "bytes");
        }
        const calls = mockRenders(rendered);
        await renderer().enqueue(
            elementRequest("stored"),
            SESSION_ID,
            RenderSource.LOAD
        );

        expect(await queueOf(0)).toEqual([]);
        expect(callsFor(calls, "stored")).toEqual([]);
    });

    // Onshape answers a thumbnail it has not rendered with a JSON error, which
    // it cannot send when the request rules that content type out. Read as a
    // failure it drops the job after three strikes, and the render never lands.
    it("treats a 406 as a render still running, not a failure", async () => {
        mockRenders(notAcceptable);
        await renderer().enqueue(
            elementRequest(),
            SESSION_ID,
            RenderSource.LOAD
        );

        const held = await renderingKey();
        expect(held).toContain(elementIdFor("e"));
        // Still queued rather than dropped, and holding the thread.
        expect(await renderer().queued()).toHaveLength(2);
    });

    // Onshape is pushing back on the account, not on this render, and waiting
    // is not the same as switching to another one.
    it("waits out a rate limit without giving up the thread", async () => {
        mockRenders(() =>
            Promise.reject(new OnshapeRateLimitError("slow down", 30))
        );
        await renderer().enqueue(
            elementRequest(),
            SESSION_ID,
            RenderSource.LOAD
        );

        // Waits for the stand-down itself. Waiting on the queue length instead
        // waits for nothing — both jobs are queued the moment `enqueue`
        // returns, so the assertion would race the drain that rate-limits them.
        await drainUntil(
            async () => (await soonestDueAt()) > Date.now() + 20_000
        );
        // Both still queued: a rate limit is not a reason to drop anything.
        expect(await renderer().queued()).toHaveLength(2);
    });

    // Retrying asks Onshape the same question for the same answer.
    it("drops a configuration Onshape has no insertable for", async () => {
        const db = getDb(env.DB);
        await resetDb(db);
        await seedGroup(db);
        const target = insertableTarget();
        await saveInsertable(db, target, parsedInsertable());

        vi.spyOn(ThumbnailEndpoints, "getThumbnailId").mockRejectedValue(
            new ThumbnailEndpoints.NoSuchConfigurationError("no such thing")
        );

        await renderer().enqueue(
            {
                kind: "configuration",
                insertableId: target.insertableId,
                elementId: target.elementPath.elementId,
                microversionId: MICROVERSION,
                configurationKey: CONFIGURATION
            },
            SESSION_ID,
            RenderSource.INSERT_MENU
        );

        expect(await queueOf(0)).toEqual([]);
    });

    // A load queues its thumbnails and moves on, so this is the only thing that
    // ever learns how one ended.
    describe("recording the outcome on the row that asked", () => {
        const db = getDb(env.DB);

        /** A stored insertable whose thumbnail is queued and still pending. */
        async function seedPendingInsertable() {
            await resetDb(db);
            await seedGroup(db);
            // Its own element too: R2 is one bucket across tests, and a key
            // another test stored would make this render succeed on the spot.
            const target = insertableTarget({
                insertableId: testId,
                elementPath: {
                    ...ELEMENT_PATH,
                    elementId: elementIdFor("owned")
                }
            });
            await saveInsertable(db, target, parsedInsertable());
            await db
                .update(insertables)
                .set({
                    smallThumbnailUrl: null,
                    largeThumbnailUrl: null,
                    buildIssues: [{ type: BuildIssueType.THUMBNAIL_PENDING }]
                })
                .where(eq(insertables.id, target.insertableId));
            return target;
        }

        const readRow = (id: string) =>
            db.select().from(insertables).where(eq(insertables.id, id)).get();

        it("writes the urls and clears pending once both sizes land", async () => {
            const target = await seedPendingInsertable();
            mockRenders(rendered);

            await renderer().enqueue(
                {
                    kind: "element",
                    elementPath: target.elementPath,
                    microversionId: target.microversionId,
                    owner: {
                        kind: "insertable",
                        libraryId: TEST_LIBRARY_ID,
                        insertableId: target.insertableId
                    }
                },
                SESSION_ID,
                RenderSource.LOAD
            );

            await drainUntil(async () => {
                const row = await readRow(target.insertableId);
                return row?.smallThumbnailUrl !== null;
            });

            const row = await readRow(target.insertableId);
            expect(row?.smallThumbnailUrl).toContain(
                target.elementPath.elementId
            );
            expect(row?.largeThumbnailUrl).toContain(
                target.elementPath.elementId
            );
            expect(row?.buildIssues).toEqual([]);
        });

        // Nothing is going to arrive, so the row should stop saying "loading".
        it("turns pending into failed when it gives up", async () => {
            const target = await seedPendingInsertable();
            // Non-retryable, so the job settles on its first attempt: what is
            // under test is what giving up does to the row, not how many
            // strikes and half-minute waits it takes to get there.
            mockRenders(() =>
                Promise.reject(
                    new ThumbnailEndpoints.NoSuchConfigurationError("gone")
                )
            );

            await renderer().enqueue(
                {
                    kind: "element",
                    elementPath: target.elementPath,
                    microversionId: target.microversionId,
                    owner: {
                        kind: "insertable",
                        libraryId: TEST_LIBRARY_ID,
                        insertableId: target.insertableId
                    }
                },
                SESSION_ID,
                RenderSource.LOAD
            );

            await drainUntil(async () => {
                const row = await readRow(target.insertableId);
                return (
                    row?.buildIssues.some(
                        (issue) =>
                            issue.type === BuildIssueType.THUMBNAIL_FAILED
                    ) ?? false
                );
            });

            const row = await readRow(target.insertableId);
            expect(row?.buildIssues.map((issue) => issue.type)).not.toContain(
                BuildIssueType.THUMBNAIL_PENDING
            );
        });

        // Clients hold the library payload by cache version; without this the
        // urls are recorded but nobody sees them.
        it("bumps the library so clients pick the urls up", async () => {
            const target = await seedPendingInsertable();
            mockRenders(rendered);
            const before = await db
                .select()
                .from(libraries)
                .where(eq(libraries.id, TEST_LIBRARY_ID))
                .get();

            await renderer().enqueue(
                {
                    kind: "element",
                    elementPath: target.elementPath,
                    microversionId: target.microversionId,
                    owner: {
                        kind: "insertable",
                        libraryId: TEST_LIBRARY_ID,
                        insertableId: target.insertableId
                    }
                },
                SESSION_ID,
                RenderSource.LOAD
            );

            await drainUntil(async () => {
                const now = await db
                    .select()
                    .from(libraries)
                    .where(eq(libraries.id, TEST_LIBRARY_ID))
                    .get();
                return (now?.cacheVersion ?? 0) > (before?.cacheVersion ?? 0);
            });
        });
    });

    it("sets no alarm when there is nothing queued", async () => {
        expect(await runDurableObjectAlarm(renderer())).toBe(false);
    });
});
