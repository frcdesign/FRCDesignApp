import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createTestApp, jsonRequest } from "../../__test_utils__";
import { ThumbnailSize } from "../../shared/types";
import {
    thumbnailConfigurationKey,
    thumbnailKey,
    thumbnailUrl
} from "../../shared/thumbnails";

const SIZE = ThumbnailSize.LARGE;
const MICROVERSION = "mv-1";
/** A configuration whose key differs from the default's. */
const CONFIGURATION = "size=l";

function get(url: string) {
    return createTestApp().request(url, jsonRequest("GET"), env);
}

describe("thumbnail serving", () => {
    it("serves a stored thumbnail, cached immutably", async () => {
        const elementId = "stored-element";
        await env.THUMBNAILS.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "gif-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("gif-bytes");
        expect(res.headers.get("Cache-Control")).toContain("immutable");
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
                size: SIZE
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
        await env.THUMBNAILS.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configuration: CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("default-bytes");
        expect(res.headers.get("Cache-Control")).not.toContain("immutable");
    });

    it("prefers the configuration's own thumbnail once it exists", async () => {
        const elementId = "configured-element";
        await env.THUMBNAILS.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
        await env.THUMBNAILS.put(
            thumbnailKey(
                elementId,
                MICROVERSION,
                SIZE,
                thumbnailConfigurationKey(CONFIGURATION)
            ),
            "configured-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configuration: CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("configured-bytes");
        expect(res.headers.get("Cache-Control")).toContain("immutable");
    });
});
