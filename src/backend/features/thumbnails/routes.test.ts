import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { RenderSource, ThumbnailSize } from "./contract";
import {
    parseThumbnailKey,
    parseThumbnailUrl,
    thumbnailKey,
    thumbnailUrl
} from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";

const SIZE = ThumbnailSize.LARGE;
const MICROVERSION = "mv-1";
/** A configuration whose key differs from the default's. */
const CANONICAL_CONFIGURATION = "size=l";

const SESSION_ID = "test-session";
const INSERTABLE_ID = "test-insertable";

function get(url: string, sessionId?: string) {
    const init = jsonRequest("GET");
    if (sessionId) {
        init.headers = {
            ...init.headers,
            Cookie: `frc-design-app-cookie=${sessionId}`
        };
    }
    return createTestApp().request(url, init, env);
}

describe("thumbnailKey", () => {
    it("gives the element default its own prefix", () => {
        expect(thumbnailKey("e1", MICROVERSION, SIZE)).toBe(
            `thumbnails/default/e1/${MICROVERSION}/${SIZE}`
        );
    });

    // A configuration's separators would otherwise open path segments of their
    // own, so two different selections could name one key.
    it("encodes a configuration into a single segment", () => {
        const key = thumbnailKey("e1", MICROVERSION, SIZE, "a=1;b=2/3");
        expect(key).toBe(
            `thumbnails/config/e1/${MICROVERSION}/a%3D1%3Bb%3D2%2F3/${SIZE}`
        );
        expect(key.split("/")).toHaveLength(6);
    });

    it("gives different configurations different keys", () => {
        expect(thumbnailKey("e1", MICROVERSION, SIZE, "a=1")).not.toBe(
            thumbnailKey("e1", MICROVERSION, SIZE, "a=2")
        );
    });
});

// Reconciliation reads keys and urls back to decide what to delete, so the
// readers have to keep pace with the builders above them.
describe("reading a thumbnail address back", () => {
    const SUBJECT = { elementId: "e1", microversionId: MICROVERSION };

    it.each(Object.values(ThumbnailSize))(
        "round-trips a %s default key",
        (size) => {
            expect(
                parseThumbnailKey(
                    thumbnailKey(
                        SUBJECT.elementId,
                        SUBJECT.microversionId,
                        size
                    )
                )
            ).toEqual(SUBJECT);
        }
    );

    it("round-trips a configuration key, separators and all", () => {
        const key = thumbnailKey(
            SUBJECT.elementId,
            SUBJECT.microversionId,
            SIZE,
            "a=1;b=2/3"
        );
        expect(parseThumbnailKey(key)).toEqual(SUBJECT);
    });

    it.each([
        ["a key under another prefix", "search-index/frcDesignLib.json"],
        ["a key with too few segments", "thumbnails/default/e1/mv-1"],
        ["a key with too many", "thumbnails/default/e1/mv-1/70x40/extra"],
        ["an unknown kind", "thumbnails/other/e1/mv-1/70x40"]
    ])("does not resolve %s", (_name, key) => {
        expect(parseThumbnailKey(key)).toBeUndefined();
    });

    // A group records its document thumbnail only as these urls.
    it("round-trips the url a group stores", () => {
        const url = thumbnailUrl({
            ...SUBJECT,
            size: SIZE,
            configurationKey: DEFAULT_CONFIGURATION_KEY
        });
        expect(parseThumbnailUrl(url)).toEqual(SUBJECT);
    });

    it("round-trips a url carrying every optional parameter", () => {
        const url = thumbnailUrl({
            ...SUBJECT,
            size: SIZE,
            configurationKey: "a=1;b=2",
            renderSource: RenderSource.ROW,
            insertableId: INSERTABLE_ID
        });
        expect(parseThumbnailUrl(url)).toEqual(SUBJECT);
    });

    it.each([
        ["a url naming no microversion", "/api/thumbnail/70x40/e1"],
        ["a url for another route", "/api/library/frcDesignLib?v=mv-1"],
        ["a url with a trailing segment", "/api/thumbnail/70x40/e1/x?v=mv-1"]
    ])("does not resolve %s", (_name, url) => {
        expect(parseThumbnailUrl(url)).toBeUndefined();
    });
});

describe("thumbnail serving", () => {
    afterEach(() => vi.restoreAllMocks());

    it("serves a stored thumbnail, cached immutably", async () => {
        const elementId = "stored-element";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "gif-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("gif-bytes");
        expect(res.headers.get("Cache-Control")).toBe(
            "public, max-age=31536000, immutable"
        );
    });

    it("requires the microversion, which is part of the key", async () => {
        const res = await get(`/api/thumbnail/${SIZE}/some-element`);
        expect(res.status).toBe(400);
    });

    it("rejects a size that is not one we store", async () => {
        const res = await get(`/api/thumbnail/999x999/some-element?v=1`);
        expect(res.status).toBe(400);
    });

    // Standing the element in would show a part nobody asked for: a favorite
    // pinned to a configuration would render as the default one.
    it("misses rather than standing the element default in", async () => {
        const elementId = "unrendered-configuration";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(404);
        // Not cached: the render can land at any moment.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("serves the configuration that is stored", async () => {
        const elementId = "exact-hit";
        await env.BLOB.put(
            thumbnailKey(
                elementId,
                MICROVERSION,
                SIZE,
                CANONICAL_CONFIGURATION
            ),
            "config-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("config-bytes");
    });

    it("404s when neither the configuration nor the default exists", async () => {
        const res = await get(
            thumbnailUrl({
                elementId: "does-not-exist",
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            })
        );
        expect(res.status).toBe(404);
        // A thumbnail uploaded later must not be shadowed by a cached miss.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("prefers the configuration's own thumbnail once it exists", async () => {
        const elementId = "configured-element";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
        await env.BLOB.put(
            thumbnailKey(
                elementId,
                MICROVERSION,
                SIZE,
                CANONICAL_CONFIGURATION
            ),
            "configured-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("configured-bytes");
        expect(res.headers.get("Cache-Control")).toContain("immutable");
    });
});

describe("queueing a configuration's thumbnail", () => {
    /** The queue the route enqueues on; `createTestApp` signs in as this user. */
    const queue = () => env.THUMBNAIL_RENDERER.getByName("test-user");

    /** Seeds only the default, so a configuration request always misses. */
    async function seedDefaultOnly(elementId: string) {
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
    }

    function renderUrl(renderSource: RenderSource, elementId: string) {
        return thumbnailUrl({
            elementId,
            microversionId: MICROVERSION,
            size: SIZE,
            configurationKey: CANONICAL_CONFIGURATION,
            renderSource,
            insertableId: INSERTABLE_ID
        });
    }

    async function getRender(
        elementId: string,
        renderSource = RenderSource.ROW
    ) {
        return get(renderUrl(renderSource, elementId), SESSION_ID);
    }

    /** What the queue holds for one element, whatever else is in it. */
    async function queuedFor(elementId: string) {
        const jobs = await queue().queued();
        return jobs.filter((job) => job.key.includes(elementId));
    }

    it("passes the source the validator accepts", () => {
        const url = thumbnailUrl({
            elementId: "any",
            microversionId: MICROVERSION,
            size: SIZE,
            configurationKey: CANONICAL_CONFIGURATION,
            renderSource: RenderSource.INSERT_MENU,
            insertableId: INSERTABLE_ID
        });
        expect(new URL(url, "http://x").searchParams.get("renderSource")).toBe(
            "insert"
        );
    });

    // Without one there is nothing to resolve the element from, so the render
    // is simply not requested.
    it("omits the source when no insertable is named", () => {
        const url = thumbnailUrl({
            elementId: "any",
            microversionId: MICROVERSION,
            size: SIZE,
            configurationKey: CANONICAL_CONFIGURATION,
            renderSource: RenderSource.ROW
        });
        expect(
            new URL(url, "http://x").searchParams.get("renderSource")
        ).toBeNull();
    });

    // Both, so the row and the hover card it opens never disagree.
    it("queues both sizes on a miss", async () => {
        await seedDefaultOnly("warm-element");

        const res = await getRender("warm-element");

        expect(res.status).toBe(404);
        expect((await queuedFor("warm-element")).map((job) => job.key)).toEqual(
            expect.arrayContaining([
                thumbnailKey(
                    "warm-element",
                    MICROVERSION,
                    ThumbnailSize.SMALL,
                    CANONICAL_CONFIGURATION
                ),
                thumbnailKey(
                    "warm-element",
                    MICROVERSION,
                    ThumbnailSize.LARGE,
                    CANONICAL_CONFIGURATION
                )
            ])
        );
    });

    // Polling is how the client waits, so asking twice has to be asking once.
    it("queues nothing new when the same render is asked for again", async () => {
        await seedDefaultOnly("repeat-element");

        await getRender("repeat-element");
        await getRender("repeat-element");

        expect(await queuedFor("repeat-element")).toHaveLength(2);
    });

    it("records which surface asked, since that is what orders the queue", async () => {
        await seedDefaultOnly("sourced-element");

        await getRender("sourced-element", RenderSource.INSERT_MENU);

        const jobs = await queuedFor("sourced-element");
        expect(
            jobs.every((job) => job.source === RenderSource.INSERT_MENU)
        ).toBe(true);
    });

    it("queues no render when there is no session to run it under", async () => {
        await seedDefaultOnly("sessionless-element");

        const res = await get(
            renderUrl(RenderSource.ROW, "sessionless-element")
        );

        expect(res.status).toBe(404);
        expect(await queuedFor("sessionless-element")).toEqual([]);
    });

    // Search results show many configurations at once; one cold search must not
    // queue a render per row against a thread that runs one at a time.
    it("queues nothing when no source is named", async () => {
        await seedDefaultOnly("cold-element");

        const res = await get(
            thumbnailUrl({
                elementId: "cold-element",
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            }),
            SESSION_ID
        );

        expect(res.status).toBe(404);
        expect(await queuedFor("cold-element")).toEqual([]);
    });

    // A client must not be able to label itself a library load, nor invent a
    // surface that outranks the insert menu.
    it("rejects a source that is not one a client may claim", async () => {
        const res = await get(
            `/api/thumbnail/${SIZE}/any?v=${MICROVERSION}&configurationKey=x&renderSource=load`
        );
        expect(res.status).toBe(400);
    });
});
