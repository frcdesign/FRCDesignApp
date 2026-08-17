import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp, jsonRequest } from "../../__test_utils__";
import { ThumbnailSize } from "../../shared/types";
import {
    THUMBNAIL_FALLBACK_CACHE_TTL,
    thumbnailKey,
    thumbnailUrl,
    thumbnailWorkflowId
} from "../../shared/thumbnails";
import {
    DEFAULT_CANONICAL_CONFIGURATION,
    canonicalConfigurationKey
} from "../../shared/canonical-configuration";

const SIZE = ThumbnailSize.LARGE;
const MICROVERSION = "mv-1";
/** A configuration whose key differs from the default's. */
const CANONICAL_CONFIGURATION = "size=l";

function get(url: string) {
    return createTestApp().request(url, jsonRequest("GET"), env);
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

    it("does not demand a version from a url that is already immutable", async () => {
        const res = await get("/api/thumbnail-id/d/doc/v/ver/e/elem");
        // The mock refuses the Onshape call, so this only proves the request
        // reached the handler rather than being rejected for a missing `?v=`.
        expect(res.status).not.toBe(400);
    });

    it("requires the microversion, which is part of the key", async () => {
        const res = await get(`/api/thumbnail/${SIZE}/some-element`);
        expect(res.status).toBe(400);
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
            warm: true
        });
        expect(new URL(url, "http://x").searchParams.get("warm")).toBe("true");
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
                warm: true
            })
        );

        expect(res.status).toBe(200);
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                id: thumbnailWorkflowId({
                    elementId,
                    microversionId: MICROVERSION,
                    canonicalConfiguration: CANONICAL_CONFIGURATION
                })
            })
        );
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
