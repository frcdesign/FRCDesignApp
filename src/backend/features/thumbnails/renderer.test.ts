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
 * Waits for the drain the runtime starts on its own. Enqueuing sets an alarm
 * for now, so the queue is already moving by the time a test looks at it, and
 * `runDurableObjectAlarm` cannot make that deterministic: it runs a scheduled
 * alarm whatever time it was scheduled for, stepping over the poll interval a
 * held render is waiting out.
 */
async function until(
    reached: () => boolean | Promise<boolean>,
    timeoutMs = 3_000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await reached()) return;
        await scheduler.wait(10);
    }
    throw new Error("the renderer never reached the expected state");
}

/** The key holding the render thread, once one does. */
async function renderingKey(): Promise<string> {
    await until(async () =>
        (await renderer().queued()).some((job) => job.rendering)
    );
    const jobs = await renderer().queued();
    return jobs.find((job) => job.rendering)!.key;
}

async function queueOf(count: number) {
    await until(async () => (await renderer().queued()).length === count);
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

        // Waited out rather than forced: `runDurableObjectAlarm` runs the
        // handler but does not move the clock, and the poll interval is what
        // the held job is sitting out.
        const held = await renderingKey();
        await until(() => callsFor(calls, "first").length >= 2, 10_000);

        expect(held).toContain(elementIdFor("first"));
        // The job behind it was due the whole time and never asked about:
        // asking would have abandoned the render in flight.
        expect(callsFor(calls, "second")).toEqual([]);
    }, 15_000);

    // Nobody is waiting on any one thumbnail of a load, so it yields to the
    // configuration someone is watching a spinner for.
    it("runs what someone is watching before what a load queued", async () => {
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

        await until(async () =>
            (await renderingKey()).includes(elementIdFor("watched"))
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

        await until(async () => (await renderer().queued()).length === 2);
        await runInDurableObject(renderer(), (_instance, state) => {
            const soonest = state.storage.sql
                .exec<{ dueAt: number }>("SELECT MIN(dueAt) AS dueAt FROM jobs")
                .one().dueAt;
            expect(soonest).toBeGreaterThan(Date.now() + 20_000);
        });
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

    it("sets no alarm when there is nothing queued", async () => {
        expect(await runDurableObjectAlarm(renderer())).toBe(false);
    });
});
