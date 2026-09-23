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

// Onshape answers 404 until the render lands, so that is waited out rather
// than treated as a failure.
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
