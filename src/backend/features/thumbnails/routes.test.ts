import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { ThumbnailSize } from "./contract";
import {
    parseThumbnailKey,
    parseThumbnailUrl,
    thumbnailKey,
    thumbnailUrl
} from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";
import { uploadConfigurationThumbnails, uploadThumbnails } from "./store";
import { thumbnailRunId } from "./workflow";
import type { OnshapeApi } from "../../lib/onshape/client";

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
            renderThumbnail: true,
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

describe("rendering a configuration's thumbnail", () => {
    afterEach(() => vi.restoreAllMocks());

    /** Seeds only the default, so a configuration request always misses. */
    async function seedDefaultOnly(elementId: string) {
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
    }

    it("passes renderThumbnail as a boolean the validator accepts", () => {
        const url = thumbnailUrl({
            elementId: "any",
            microversionId: MICROVERSION,
            size: SIZE,
            configurationKey: CANONICAL_CONFIGURATION,
            renderThumbnail: true,
            insertableId: INSERTABLE_ID
        });
        expect(
            new URL(url, "http://x").searchParams.get("renderThumbnail")
        ).toBe("true");
    });

    // Without one there is nothing to resolve the element from, so the render
    // is simply not requested.
    it("omits renderThumbnail when no insertable is named", () => {
        const url = thumbnailUrl({
            elementId: "any",
            microversionId: MICROVERSION,
            size: SIZE,
            configurationKey: CANONICAL_CONFIGURATION,
            renderThumbnail: true
        });
        expect(
            new URL(url, "http://x").searchParams.get("renderThumbnail")
        ).toBeNull();
    });

    it("starts the render on a miss", async () => {
        const elementId = "warm-element";
        await seedDefaultOnly(elementId);
        // A run per instance created, since an empty result is how the route
        // reads "the id is already held" rather than "nothing to start".
        const createSpy = vi
            .spyOn(env.THUMBNAIL_WORKFLOW, "createBatch")
            .mockResolvedValue([{ id: "run" }] as never);

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION,
                renderThumbnail: true,
                insertableId: INSERTABLE_ID
            }),
            SESSION_ID
        );

        expect(res.status).toBe(404);
        expect(createSpy).toHaveBeenCalledWith([
            expect.objectContaining({
                params: {
                    insertableId: INSERTABLE_ID,
                    configurationKey: CANONICAL_CONFIGURATION,
                    microversionId: MICROVERSION,
                    // The render runs later, so it needs a session to authenticate.
                    sessionId: SESSION_ID
                }
            })
        ]);
    });

    /**
     * Stands in for a run already holding the id: `createBatch` starts nothing,
     * and `get` answers with a run in `status`.
     */
    function heldRun(status: InstanceStatus["status"]) {
        const restart = vi.fn().mockResolvedValue(undefined);
        vi.spyOn(env.THUMBNAIL_WORKFLOW, "createBatch").mockResolvedValue(
            [] as never
        );
        vi.spyOn(env.THUMBNAIL_WORKFLOW, "get").mockResolvedValue({
            id: "run",
            status: () => Promise.resolve({ status }),
            restart
        } as never);
        return restart;
    }

    async function getRender(elementId: string) {
        return get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION,
                renderThumbnail: true,
                insertableId: INSERTABLE_ID
            }),
            SESSION_ID
        );
    }

    // An id is held for its whole retention window whether the run worked or
    // failed, so without this a render that died once could never run again.
    it("restarts a render that stopped without storing anything", async () => {
        await seedDefaultOnly("errored-element");
        const restart = heldRun("errored");

        expect((await getRender("errored-element")).status).toBe(404);
        expect(restart).toHaveBeenCalled();
    });

    it("leaves a render that is still running alone", async () => {
        await seedDefaultOnly("running-element");
        const restart = heldRun("running");

        expect((await getRender("running-element")).status).toBe(404);
        expect(restart).not.toHaveBeenCalled();
    });

    // Complete means it stored what it was asked for, under the microversion
    // its own row named; rerunning it would only store the same thing again.
    it("does not restart a render that completed", async () => {
        await seedDefaultOnly("complete-element");
        const restart = heldRun("complete");

        expect((await getRender("complete-element")).status).toBe(404);
        expect(restart).not.toHaveBeenCalled();
    });

    // Polling is how the client waits, so asking twice has to be asking once.
    it("names the run after the render, so a repeat poll starts nothing new", async () => {
        const params = {
            insertableId: INSERTABLE_ID,
            configurationKey: CANONICAL_CONFIGURATION,
            microversionId: MICROVERSION
        };
        expect(await thumbnailRunId(params)).toBe(
            await thumbnailRunId({ ...params })
        );
        expect(await thumbnailRunId(params)).not.toBe(
            await thumbnailRunId({ ...params, configurationKey: "other=1" })
        );
        expect(await thumbnailRunId(params)).not.toBe(
            await thumbnailRunId({ ...params, microversionId: "mv-other" })
        );
    });

    it("starts no render when there is no session to run it under", async () => {
        const elementId = "sessionless-element";
        await seedDefaultOnly(elementId);
        const createSpy = vi.spyOn(env.THUMBNAIL_WORKFLOW, "createBatch");

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION,
                renderThumbnail: true,
                insertableId: INSERTABLE_ID
            })
        );

        expect(res.status).toBe(404);
        expect(createSpy).not.toHaveBeenCalled();
    });

    // Search results show many configurations at once; one cold search must not
    // kick off a render per row.
    it("does not start the render when renderThumbnail is absent", async () => {
        const elementId = "cold-element";
        await seedDefaultOnly(elementId);
        const createSpy = vi.spyOn(env.THUMBNAIL_WORKFLOW, "createBatch");

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );

        expect(res.status).toBe(404);
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("rejects a renderThumbnail that is not a boolean", async () => {
        const res = await get(
            `/api/thumbnail/${SIZE}/any?v=${MICROVERSION}&configuration=x&renderThumbnail=maybe`
        );
        expect(res.status).toBe(400);
    });
});

describe("uploadConfigurationThumbnails", () => {
    const THUMBNAIL_ID = "tid";

    /** Stands in for Onshape; only the calls matter, not the bytes. */
    function fakeOnshapeApi() {
        const getImage = vi.fn().mockResolvedValue(new ArrayBuffer(4));
        return { api: { getImage } as unknown as OnshapeApi, getImage };
    }

    function upload(api: OnshapeApi, elementId: string) {
        return uploadConfigurationThumbnails(
            env.BLOB,
            api,
            THUMBNAIL_ID,
            { elementId, microversionId: MICROVERSION },
            CANONICAL_CONFIGURATION
        );
    }

    function configurationKey(elementId: string, size: ThumbnailSize) {
        return thumbnailKey(
            elementId,
            MICROVERSION,
            size,
            CANONICAL_CONFIGURATION
        );
    }

    it("renders and stores both sizes", async () => {
        const { api } = fakeOnshapeApi();

        await upload(api, "upload-element");

        for (const size of [ThumbnailSize.SMALL, ThumbnailSize.LARGE]) {
            expect(
                await env.BLOB.head(configurationKey("upload-element", size))
            ).not.toBeNull();
        }
    });

    // Runs are no longer deduplicated by instance id, so this is what keeps a
    // second run from paying for a render Onshape already did.
    it("skips Onshape entirely when both sizes are already stored", async () => {
        for (const size of [ThumbnailSize.SMALL, ThumbnailSize.LARGE]) {
            await env.BLOB.put(
                configurationKey("already-stored", size),
                "bytes"
            );
        }
        const { api, getImage } = fakeOnshapeApi();

        await upload(api, "already-stored");

        expect(getImage).not.toHaveBeenCalled();
    });

    // One size present is a half-done render, not a reason to skip — and not a
    // reason to fetch the size already in hand either.
    it("renders only the size that is missing", async () => {
        await env.BLOB.put(
            configurationKey("half-stored", ThumbnailSize.SMALL),
            "bytes"
        );
        const { api, getImage } = fakeOnshapeApi();

        await upload(api, "half-stored");

        expect(getImage).toHaveBeenCalledTimes(1);
        expect(getImage.mock.calls[0][0]).toContain(ThumbnailSize.LARGE);
    });

    // Onshape renders the sizes independently, so a poll can find one ready and
    // the other not. Storing the ready one leaves the next attempt a single
    // size to ask for, rather than fetching a pair it throws away again.
    it("keeps the size that rendered when the other is not ready", async () => {
        const getImage = vi.fn((path: string) =>
            path.includes(ThumbnailSize.LARGE)
                ? Promise.reject(new Error("not rendered"))
                : Promise.resolve(new ArrayBuffer(4))
        );
        const api = { getImage } as unknown as OnshapeApi;

        await expect(upload(api, "one-ready")).rejects.toThrow("not rendered");

        expect(
            await env.BLOB.head(
                configurationKey("one-ready", ThumbnailSize.SMALL)
            )
        ).not.toBeNull();

        getImage.mockImplementation(() => Promise.resolve(new ArrayBuffer(4)));
        await upload(api, "one-ready");

        // Two calls for the first attempt and one for the retry: the size that
        // landed is not asked for again.
        expect(getImage).toHaveBeenCalledTimes(3);
        expect(
            await env.BLOB.head(
                configurationKey("one-ready", ThumbnailSize.LARGE)
            )
        ).not.toBeNull();
    });
});

describe("uploadThumbnails", () => {
    const elementPath = {
        documentId: "d",
        instanceId: "v",
        instanceType: "v" as const,
        elementId: "default-upload-element"
    };

    function fakeOnshapeApi() {
        const getImage = vi.fn().mockResolvedValue(new ArrayBuffer(4));
        return { api: { getImage } as unknown as OnshapeApi, getImage };
    }

    it("renders and stores both sizes", async () => {
        const { api, getImage } = fakeOnshapeApi();

        const urls = await uploadThumbnails(
            env.BLOB,
            api,
            elementPath,
            MICROVERSION
        );

        expect(getImage).toHaveBeenCalledTimes(2);
        expect(urls.small).toContain(elementPath.elementId);
        for (const size of [ThumbnailSize.SMALL, ThumbnailSize.LARGE]) {
            expect(
                await env.BLOB.head(
                    thumbnailKey(elementPath.elementId, MICROVERSION, size)
                )
            ).not.toBeNull();
        }
    });

    // A forced reload reaches here with the microversion unchanged, and the key
    // pins the microversion — so what is stored is what Onshape would send back.
    it("skips Onshape when both sizes are already stored", async () => {
        const storedPath = { ...elementPath, elementId: "already-rendered" };
        for (const size of [ThumbnailSize.SMALL, ThumbnailSize.LARGE]) {
            await env.BLOB.put(
                thumbnailKey(storedPath.elementId, MICROVERSION, size),
                "bytes"
            );
        }
        const { api, getImage } = fakeOnshapeApi();

        const urls = await uploadThumbnails(
            env.BLOB,
            api,
            storedPath,
            MICROVERSION
        );

        expect(getImage).not.toHaveBeenCalled();
        // Still the urls the group row records, not a skipped result.
        expect(urls.small).toContain(storedPath.elementId);
        expect(urls.large).toContain(storedPath.elementId);
    });

    // One size present is a half-done upload, not a reason to skip — and not a
    // reason to fetch the size already in hand either.
    it("renders only the size that is missing", async () => {
        const partialPath = { ...elementPath, elementId: "half-rendered" };
        await env.BLOB.put(
            thumbnailKey(
                partialPath.elementId,
                MICROVERSION,
                ThumbnailSize.SMALL
            ),
            "bytes"
        );
        const { api, getImage } = fakeOnshapeApi();

        await uploadThumbnails(env.BLOB, api, partialPath, MICROVERSION);

        expect(getImage).toHaveBeenCalledTimes(1);
        expect(getImage.mock.calls[0][0]).toContain(ThumbnailSize.LARGE);
    });

    // The two calls go out together, so one can come back rendered and the
    // other not. Storing the one that landed is what keeps a retry from
    // fetching the pair again and discarding it again.
    it("keeps the size that rendered when the other is not ready", async () => {
        const failingPath = { ...elementPath, elementId: "one-rendered" };
        const getImage = vi.fn((path: string) =>
            path.includes(ThumbnailSize.LARGE)
                ? Promise.reject(new Error("not rendered"))
                : Promise.resolve(new ArrayBuffer(4))
        );
        const api = { getImage } as unknown as OnshapeApi;
        const keyFor = (size: ThumbnailSize) =>
            thumbnailKey(failingPath.elementId, MICROVERSION, size);

        await expect(
            uploadThumbnails(env.BLOB, api, failingPath, MICROVERSION)
        ).rejects.toThrow("not rendered");

        expect(await env.BLOB.head(keyFor(ThumbnailSize.SMALL))).not.toBeNull();

        getImage.mockImplementation(() => Promise.resolve(new ArrayBuffer(4)));
        await uploadThumbnails(env.BLOB, api, failingPath, MICROVERSION);

        // Two calls for the first attempt and one for the retry: the size that
        // landed is not asked for again.
        expect(getImage).toHaveBeenCalledTimes(3);
        expect(await env.BLOB.head(keyFor(ThumbnailSize.LARGE))).not.toBeNull();
    });
});
