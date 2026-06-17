import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createTestApp, jsonRequest } from "../../__test_utils__";

// Mirrors r2Key() in thumbnails.ts: `thumbnails/${size}/${elementId}`.
const SIZE = "300x300";

describe("thumbnail serving", () => {
    it("GET /thumbnail/:size/:elementId serves a stored thumbnail from R2", async () => {
        const elementId = "stored-element";
        await env.THUMBNAILS.put(
            `thumbnails/${SIZE}/${elementId}`,
            "gif-bytes"
        );
        const app = createTestApp();

        const res = await app.request(
            `/api/thumbnail/${SIZE}/${elementId}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("gif-bytes");
    });

    it("GET /thumbnail/:size/:elementId 404s when the object is missing", async () => {
        const app = createTestApp();
        const res = await app.request(
            `/api/thumbnail/${SIZE}/does-not-exist`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(404);
    });
});
