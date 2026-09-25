import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type PushMessage, PushType } from "@backend/features/push/contract";
import { thumbnailUrl } from "@backend/features/thumbnails/keys";
import { ThumbnailSize } from "@backend/features/thumbnails/contract";

const pushes = vi.hoisted(() => ({
    listeners: new Set<(message: PushMessage) => void>()
}));

vi.mock("../../lib/push-socket", () => ({
    subscribePushes: (listener: (message: PushMessage) => void) => {
        pushes.listeners.add(listener);
        return () => pushes.listeners.delete(listener);
    }
}));

const { loadRenderedImage } = await import("./render-wait");

const URL_WAITED_ON = thumbnailUrl({
    elementId: "e1",
    microversionId: "mv1",
    size: ThumbnailSize.LARGE,
    configurationKey: "size=large"
});

const push = (configurationKey: string) =>
    pushes.listeners.forEach((listener) =>
        listener({
            type: PushType.THUMBNAIL,
            elementId: "e1",
            microversionId: "mv1",
            configurationKey
        })
    );

/** The route: not rendered, until `landed` says it is. */
function mockRoute() {
    const route = { landed: false };
    const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(() =>
            Promise.resolve(
                new Response(null, { status: route.landed ? 200 : 404 })
            )
        );
    return { route, fetch };
}

describe("waiting out a render", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("asks again as soon as the render is pushed, not on a timer", async () => {
        const { route, fetch } = mockRoute();
        const loaded = loadRenderedImage(URL_WAITED_ON);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(fetch).toHaveBeenCalledTimes(1);

        route.landed = true;
        push("size=large");

        await expect(loaded).resolves.toBe(URL_WAITED_ON);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("ignores a push for another configuration", async () => {
        const { fetch } = mockRoute();
        void loadRenderedImage(URL_WAITED_ON).catch(() => undefined);
        await vi.advanceTimersByTimeAsync(0);

        push("size=small");
        await vi.advanceTimersByTimeAsync(10_000);

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    // A push can be lost, so the deadline asks once more before giving up.
    it("asks once more at the deadline without a push", async () => {
        const { route, fetch } = mockRoute();
        const loaded = loadRenderedImage(URL_WAITED_ON);
        route.landed = true;

        await vi.advanceTimersByTimeAsync(60_000);

        await expect(loaded).resolves.toBe(URL_WAITED_ON);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
