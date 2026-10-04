import { env } from "cloudflare:workers";
import { introspectWorkflowInstance } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import * as ThumbnailEndpoints from "../../lib/onshape/endpoints/thumbnails";
import * as RequestAuth from "../auth/request-auth";
import { OnshapeApiError, type OAuthApi } from "../../lib/onshape/client";
import { ThumbnailSize } from "./contract";
import { thumbnailKey } from "./keys";

afterEach(() => vi.restoreAllMocks());

const key = (size: ThumbnailSize) => thumbnailKey("e1", "mv1", size, "a=1");

it("stores both sizes once Onshape has rendered them", async () => {
    vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockResolvedValue(
        {} as OAuthApi
    );
    const fetch = vi
        .spyOn(ThumbnailEndpoints, "getThumbnailFromId")
        .mockRejectedValueOnce(new OnshapeApiError("rendering", 404))
        .mockResolvedValue(new TextEncoder().encode("gif").buffer);

    await using instance = await introspectWorkflowInstance(
        env.RENDER_THUMBNAIL_WORKFLOW,
        "render-test"
    );
    await instance.modify(async (m) => {
        await m.disableRetryDelays();
    });
    await env.RENDER_THUMBNAIL_WORKFLOW.create({
        id: "render-test",
        params: {
            thumbnailId: "thumbnail-id",
            targets: [
                { size: ThumbnailSize.LARGE, key: key(ThumbnailSize.LARGE) },
                { size: ThumbnailSize.SMALL, key: key(ThumbnailSize.SMALL) }
            ],
            elementId: "e1",
            microversionId: "mv1",
            configurationKey: "a=1",
            sessionId: "session"
        }
    });
    await instance.waitForStatus("complete");

    // The id it was handed, never one it resolved again itself.
    expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        "thumbnail-id",
        ThumbnailSize.LARGE
    );
    for (const size of Object.values(ThumbnailSize)) {
        const stored = await env.BLOB.get(key(size));
        expect(stored?.customMetadata).toEqual({
            microversionId: "mv1",
            configurationKey: "a=1"
        });
    }
});

it("waits out Onshape answering a configuration with the element's default", async () => {
    vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockResolvedValue(
        {} as OAuthApi
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const encode = (text: string) => new TextEncoder().encode(text).buffer;
    const defaultKey = (size: ThumbnailSize) => thumbnailKey("e2", "mv2", size);
    const configuredKey = (size: ThumbnailSize) =>
        thumbnailKey("e2", "mv2", size, "a=2");
    for (const size of Object.values(ThumbnailSize)) {
        await env.BLOB.put(defaultKey(size), encode("default"));
    }
    vi.spyOn(ThumbnailEndpoints, "getThumbnailFromId")
        .mockResolvedValueOnce(encode("default"))
        .mockResolvedValueOnce(encode("default"))
        .mockResolvedValue(encode("configured"));

    await using instance = await introspectWorkflowInstance(
        env.RENDER_THUMBNAIL_WORKFLOW,
        "render-default-answer"
    );
    await instance.modify(async (m) => {
        await m.disableRetryDelays();
    });
    await env.RENDER_THUMBNAIL_WORKFLOW.create({
        id: "render-default-answer",
        params: {
            thumbnailId: "thumbnail-id",
            targets: Object.values(ThumbnailSize).map((size) => ({
                size,
                key: configuredKey(size)
            })),
            elementId: "e2",
            microversionId: "mv2",
            configurationKey: "a=2",
            sessionId: "session"
        }
    });
    await instance.waitForStatus("complete");

    for (const size of Object.values(ThumbnailSize)) {
        const stored = await env.BLOB.get(configuredKey(size));
        expect(await stored?.text()).toBe("configured");
    }
});
