import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { ThumbnailSize } from "./types";
import {
    THUMBNAIL_FALLBACK_CACHE_TTL,
    THUMBNAIL_FALLBACK_HEADER,
    thumbnailKey,
    thumbnailUrl
} from "./keys";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    canonicalConfigurationKey
} from "../configurations/canonical";
import { uploadConfigurationThumbnails } from "./store";
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
                canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
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

    it("marks a stood-in default so the client keeps waiting", async () => {
        const elementId = "fallback-flagged";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(res.headers.get(THUMBNAIL_FALLBACK_HEADER)).toBe("1");
    });

    it("does not mark a real hit as a fallback", async () => {
        const elementId = "exact-hit";
        await env.BLOB.put(
            thumbnailKey(
                elementId,
                MICROVERSION,
                SIZE,
                canonicalConfigurationKey(CANONICAL_CONFIGURATION)
            ),
            "config-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(res.headers.get(THUMBNAIL_FALLBACK_HEADER)).toBeNull();
    });

    it("404s when neither the configuration nor the default exists", async () => {
        const res = await get(
            thumbnailUrl({
                elementId: "does-not-exist",
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: DEFAULT_CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(404);
        // A thumbnail uploaded later must not be shadowed by a cached miss.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    // A configuration we haven't rendered stands in with the element's default,
    // cached briefly so the real render can take over as soon as it lands.
    it("falls back to the default thumbnail, cached only briefly", async () => {
        const elementId = "fallback-element";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("default-bytes");
        expect(res.headers.get("Cache-Control")).toBe(
            `public, max-age=${THUMBNAIL_FALLBACK_CACHE_TTL}`
        );
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
                canonicalConfigurationKey(CANONICAL_CONFIGURATION)
            ),
            "configured-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("configured-bytes");
        expect(res.headers.get("Cache-Control")).toContain("immutable");
    });
});

describe("warming a configuration's thumbnail", () => {
    afterEach(() => vi.restoreAllMocks());

    /** Seeds only the default, so a configuration request always misses. */
    async function seedDefaultOnly(elementId: string) {
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
    }

    it("passes warm as a boolean the validator accepts", () => {
        const url = thumbnailUrl({
            elementId: "any",
            microversionId: MICROVERSION,
            size: SIZE,
            canonicalConfiguration: CANONICAL_CONFIGURATION,
            warm: true,
            insertableId: INSERTABLE_ID
        });
        expect(new URL(url, "http://x").searchParams.get("warm")).toBe("true");
    });

    // Without one there is nothing to resolve the element from, so warming is
    // simply not requested.
    it("omits warm when no insertable is named", () => {
        const url = thumbnailUrl({
            elementId: "any",
            microversionId: MICROVERSION,
            size: SIZE,
            canonicalConfiguration: CANONICAL_CONFIGURATION,
            warm: true
        });
        expect(new URL(url, "http://x").searchParams.get("warm")).toBeNull();
    });

    it("starts the render on a miss", async () => {
        const elementId = "warm-element";
        await seedDefaultOnly(elementId);
        const createSpy = vi
            .spyOn(env.THUMBNAIL_WORKFLOW, "create")
            .mockResolvedValue({} as never);

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION,
                warm: true,
                insertableId: INSERTABLE_ID
            }),
            SESSION_ID
        );

        expect(res.status).toBe(200);
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                params: {
                    insertableId: INSERTABLE_ID,
                    canonicalConfiguration: CANONICAL_CONFIGURATION,
                    // The render runs later, so it needs a session to authenticate.
                    sessionId: SESSION_ID
                }
            })
        );
    });

    // The bytes still have to be served; only the render is given up on.
    it("still serves the fallback when there is no session to render under", async () => {
        const elementId = "sessionless-element";
        await seedDefaultOnly(elementId);
        const createSpy = vi.spyOn(env.THUMBNAIL_WORKFLOW, "create");

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION,
                warm: true,
                insertableId: INSERTABLE_ID
            })
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe("default-bytes");
        expect(createSpy).not.toHaveBeenCalled();
    });

    // Search results show many configurations at once; one cold search must not
    // kick off a render per row.
    it("does not start the render when warm is absent", async () => {
        const elementId = "cold-element";
        await seedDefaultOnly(elementId);
        const createSpy = vi.spyOn(env.THUMBNAIL_WORKFLOW, "create");

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                canonicalConfiguration: CANONICAL_CONFIGURATION
            })
        );

        expect(res.status).toBe(200);
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("rejects a warm that is not a boolean", async () => {
        const res = await get(
            `/api/thumbnail/${SIZE}/any?v=${MICROVERSION}&c=x&warm=maybe`
        );
        expect(res.status).toBe(400);
    });
});

describe("uploadConfigurationThumbnails", () => {
    const elementPath = {
        documentId: "d",
        instanceId: "v",
        instanceType: "v" as const,
        elementId: "upload-element"
    };

    /** Stands in for Onshape; only the calls matter, not the bytes. */
    function fakeOnshapeApi() {
        const getImage = vi.fn().mockResolvedValue(new ArrayBuffer(4));
        const api = {
            get: vi.fn().mockResolvedValue({
                items: [{ predictableThumbnailId: "tid" }]
            }),
            getImage
        } as unknown as OnshapeApi;
        return { api, getImage };
    }

    it("renders and stores both sizes", async () => {
        const { api } = fakeOnshapeApi();

        await uploadConfigurationThumbnails(
            env.BLOB,
            api,
            elementPath,
            MICROVERSION,
            CANONICAL_CONFIGURATION
        );

        const key = (size: ThumbnailSize) =>
            thumbnailKey(
                elementPath.elementId,
                MICROVERSION,
                size,
                canonicalConfigurationKey(CANONICAL_CONFIGURATION)
            );
        expect(await env.BLOB.head(key(ThumbnailSize.SMALL))).not.toBeNull();
        expect(await env.BLOB.head(key(ThumbnailSize.LARGE))).not.toBeNull();
    });

    // Runs are no longer deduplicated by instance id, so this is what keeps a
    // second run from paying for a render Onshape already did.
    it("skips Onshape entirely when both sizes are already stored", async () => {
        const storedPath = { ...elementPath, elementId: "already-stored" };
        for (const size of [ThumbnailSize.SMALL, ThumbnailSize.LARGE]) {
            await env.BLOB.put(
                thumbnailKey(
                    storedPath.elementId,
                    MICROVERSION,
                    size,
                    canonicalConfigurationKey(CANONICAL_CONFIGURATION)
                ),
                "bytes"
            );
        }
        const { api, getImage } = fakeOnshapeApi();

        await uploadConfigurationThumbnails(
            env.BLOB,
            api,
            storedPath,
            MICROVERSION,
            CANONICAL_CONFIGURATION
        );

        expect(getImage).not.toHaveBeenCalled();
    });

    // One size present is a half-done render, not a reason to skip.
    it("renders when only one size is stored", async () => {
        const partialPath = { ...elementPath, elementId: "half-stored" };
        await env.BLOB.put(
            thumbnailKey(
                partialPath.elementId,
                MICROVERSION,
                ThumbnailSize.SMALL,
                canonicalConfigurationKey(CANONICAL_CONFIGURATION)
            ),
            "bytes"
        );
        const { api, getImage } = fakeOnshapeApi();

        await uploadConfigurationThumbnails(
            env.BLOB,
            api,
            partialPath,
            MICROVERSION,
            CANONICAL_CONFIGURATION
        );

        expect(getImage).toHaveBeenCalled();
    });
});
