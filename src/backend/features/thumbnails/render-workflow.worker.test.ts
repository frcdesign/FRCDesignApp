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

const WORKSPACE_ELEMENT = {
    documentId: "d1",
    instanceId: "w-thumbnails",
    instanceType: "w" as const,
    elementId: "e1"
};

it("stores both sizes once Onshape has rendered them", async () => {
    vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockResolvedValue(
        {} as OAuthApi
    );
    const fetch = vi
        .spyOn(ThumbnailEndpoints, "getConfiguredThumbnail")
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
            elementPath: WORKSPACE_ELEMENT,
            configuration: { a: "1" },
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

    expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        WORKSPACE_ELEMENT,
        { a: "1" },
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
