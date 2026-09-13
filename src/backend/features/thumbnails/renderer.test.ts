import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import { resetDb, seedGroup } from "../../../__test_utils__";
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
import { RenderSource, ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";
import type { ThumbnailRequest } from "./renderer";

const MICROVERSION = "mv-1";
const SESSION_ID = "renderer-session";
const CONFIGURATION = "size=l";

/**
 * A fresh object and a fresh element per test: the queue is per object, but R2
 * is one bucket, and a key another test stored is a key this one skips.
 */
let testId = "";
const renderer = () => env.THUMBNAIL_RENDERER.getByName(testId);
const elementIdFor = (name: string) => `${testId}-${name}`;

/**
 * A render of one configuration. The element is per test and the configuration
 * names the render, so two of these are two different renders competing.
 */
const request = (name = "e", configurationKey = CONFIGURATION) =>
    ({
        insertableId: testId,
        elementId: elementIdFor(name),
        microversionId: MICROVERSION,
        configurationKey
    }) satisfies ThumbnailRequest;

const keyFor = (
    name: string,
    size: ThumbnailSize,
    configuration = CONFIGURATION
) => thumbnailKey(elementIdFor(name), MICROVERSION, size, configuration);

const bothKeys = (name: string, configuration = CONFIGURATION) =>
    [ThumbnailSize.SMALL, ThumbnailSize.LARGE].map((size) =>
        keyFor(name, size, configuration)
    );

/** The stored insertable a render resolves its element path from. */
async function seedInsertableRow() {
    const db = getDb(env.DB);
    await resetDb(db);
    await seedGroup(db);
    await saveInsertable(
        db,
        insertableTarget({ insertableId: testId }),
        parsedInsertable()
    );
}

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

/**
 * Onshape's answer for a render, by the id it was asked about. The id is
 * derived from the configuration so two renders are told apart.
 */
function mockRenders(answer: (thumbnailId: string) => Promise<ArrayBuffer>) {
    vi.spyOn(ThumbnailEndpoints, "getThumbnailId").mockImplementation(
        (_client, _path, configurationKey) =>
            Promise.resolve(`tid-${configurationKey}`)
    );
    return vi
        .spyOn(ThumbnailEndpoints, "getThumbnailFromId")
        .mockImplementation((_client, thumbnailId) => answer(thumbnailId));
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

/** What Onshape was asked about one configuration, in order. */
function callsFor(
    calls: ReturnType<typeof mockRenders>,
    configuration: string
): unknown[] {
    return calls.mock.calls.filter(
        (call) => call[1] === `tid-${configuration}`
    );
}

describe("ThumbnailRenderer", () => {
    beforeEach(async () => {
        testId = `t${crypto.randomUUID()}`;
        await seedSession();
        await seedInsertableRow();
    });

    afterEach(() => vi.restoreAllMocks());

    it("queues both sizes of one request", async () => {
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);

        expect((await renderer().queued()).map((job) => job.key)).toEqual(
            expect.arrayContaining(bothKeys("e"))
        );
    });

    // A client polls the route, and every poll re-enqueues; without this the
    // queue would grow a job per poll.
    it("names a job by its key, so enqueuing twice enqueues once", async () => {
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);

        expect(await renderer().queued()).toHaveLength(2);
    });

    it("stores what Onshape rendered and drops the job", async () => {
        mockRenders(rendered);
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);

        expect(await queueOf(0)).toEqual([]);
        for (const key of bothKeys("e")) {
            expect(await env.BLOB.head(key)).not.toBeNull();
        }
    });

    // The whole point of the object: asking Onshape for a different thumbnail
    // abandons the render in flight, so a job that has started one is polled to
    // the exclusion of everything else.
    it("holds the render thread until its own render lands", async () => {
        // Two configurations of one element: two renders, and Onshape will
        // only ever finish the second.
        const calls = mockRenders((thumbnailId) =>
            thumbnailId === "tid-size=l" ? stillRendering() : rendered()
        );
        await renderer().enqueue(
            request("e", "size=l"),
            SESSION_ID,
            RenderSource.LOAD
        );
        await renderer().enqueue(
            request("e", "size=s"),
            SESSION_ID,
            RenderSource.LOAD
        );

        const held = await renderingKey();
        // More passes, so "never asked about" means the queue had every chance
        // to ask and did not.
        await settle();

        expect(held).toContain(encodeURIComponent("size=l"));
        // The job behind it was due the whole time and never asked about:
        // asking would have abandoned the render in flight.
        expect(callsFor(calls, "size=s")).toEqual([]);
    });

    // Nobody is waiting on any one thumbnail of a load, so it yields to the
    // configuration someone is watching a spinner for.
    it("runs what someone is watching before what a load queued", async () => {
        mockRenders(notAsked);
        await renderer().enqueue(
            request("loaded"),
            SESSION_ID,
            RenderSource.LOAD
        );
        await renderer().enqueue(
            request("watched"),
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
        await renderer().enqueue(request("row"), SESSION_ID, RenderSource.ROW);
        expect((await renderer().queued())[0].key).toBe(
            keyFor("row", ThumbnailSize.SMALL)
        );

        testId = `t${crypto.randomUUID()}`;
        await renderer().enqueue(
            request("menu"),
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
            request("loaded"),
            SESSION_ID,
            RenderSource.LOAD
        );
        expect(await renderingKey()).toContain(elementIdFor("loaded"));

        await renderer().enqueue(
            request("watched"),
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
            request("watched"),
            SESSION_ID,
            RenderSource.INSERT_MENU
        );
        const held = await renderingKey();

        await renderer().enqueue(
            request("watched"),
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
            request("stored"),
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
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);

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
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);

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
        vi.spyOn(ThumbnailEndpoints, "getThumbnailId").mockRejectedValue(
            new ThumbnailEndpoints.NoSuchConfigurationError("no such thing")
        );

        await renderer().enqueue(
            request(),
            SESSION_ID,
            RenderSource.INSERT_MENU
        );

        expect(await queueOf(0)).toEqual([]);
    });

    it("abandons a render that runs out of thread time", async () => {
        mockRenders(stillRendering);
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);
        const held = await renderingKey();

        // Backdated past the limit rather than waited out: what is under test
        // is that reaching it ends the job, not how long reaching it takes.
        await runInDurableObject(renderer(), (_instance, state) => {
            state.storage.sql.exec(
                `UPDATE jobs SET startedAt = 0, dueAt = ?
                 WHERE startedAt IS NOT NULL`,
                Date.now()
            );
        });

        const gone = async () =>
            !(await renderer().queued()).some((job) => job.key === held);
        await drainUntil(gone);

        // Dropped outright rather than requeued for another hold on the thread.
        await settle();
        expect(await gone()).toBe(true);
    });

    it("throws away a queue left by an older generation", async () => {
        await renderer().enqueue(request(), SESSION_ID, RenderSource.LOAD);
        expect(await renderer().queued()).toHaveLength(2);

        await runInDurableObject(renderer(), (_instance, state) => {
            state.storage.kv.put("generation", 0);
        });
        // Anything that touches the queue is what notices.
        await renderer().enqueue(
            request("after"),
            SESSION_ID,
            RenderSource.LOAD
        );

        // Only what was queued after the purge.
        expect(
            (await renderer().queued()).every((job) =>
                job.key.includes(elementIdFor("after"))
            )
        ).toBe(true);
    });

    it("sets no alarm when there is nothing queued", async () => {
        expect(await runDurableObjectAlarm(renderer())).toBe(false);
    });
});
