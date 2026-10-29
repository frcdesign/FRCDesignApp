/** The server pushes when a render lands, so a miss waits for that rather than polling. */
import { DEFAULT_CONFIGURATION_KEY } from "@backend/features/configurations/contract";
import { type PushMessage, PushType } from "@backend/features/push/contract";
import { parseThumbnailUrl } from "@backend/features/thumbnails/keys";
import { RenderStatus } from "@backend/features/thumbnails/contract";
import { loadImage } from "../../lib/api-client";
import { subscribePushes } from "../../lib/push-socket";

/** As long as `RenderThumbnailWorkflow` tries. */
const RENDER_TIMEOUT_MS = 60_000;

/** The part didn't regenerate, so no render is coming. */
class NoPartError extends Error {
    constructor() {
        super("The configuration has no part to render.");
        this.name = "NoPartError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export function isInvalidConfiguration(error: unknown): boolean {
    return error instanceof NoPartError;
}

/** Whether a push says the render `url` serves has landed. */
export function isRenderOf(url: string, message: PushMessage): boolean {
    if (message.type !== PushType.THUMBNAIL) {
        return false;
    }
    const subject = parseThumbnailUrl(url);
    const configurationKey =
        URL.parse(url, window.location.origin)?.searchParams.get(
            "configurationKey"
        ) ?? DEFAULT_CONFIGURATION_KEY;
    return (
        subject?.elementId === message.elementId &&
        subject.microversionId === message.microversionId &&
        configurationKey === message.configurationKey
    );
}

/** Resolves after `ms`, or sooner on `wake`; rejects when `signal` aborts. */
function sleep(
    ms: number,
    signal: AbortSignal | undefined,
    onWake: (wake: () => void) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const done = () => {
            window.clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            resolve();
        };
        const abort = () => {
            window.clearTimeout(timer);
            reject(signal?.reason as Error);
        };
        const timer = window.setTimeout(done, ms);
        signal?.addEventListener("abort", abort, { once: true });
        onWake(done);
    });
}

/** Starts the render on the first miss; throws once no render is coming. */
export async function loadRenderedImage(
    url: string,
    startRender: () => Promise<RenderStatus>,
    signal?: AbortSignal
): Promise<string> {
    const deadline = Date.now() + RENDER_TIMEOUT_MS;
    // Subscribed before the first ask, so a push during it isn't missed.
    const waiting: { pushed: boolean; wake?: () => void } = { pushed: false };
    const stopMessages = subscribePushes((message) => {
        if (isRenderOf(url, message)) {
            waiting.pushed = true;
            waiting.wake?.();
        }
    });
    let started = false;
    try {
        for (;;) {
            waiting.pushed = false;
            try {
                return await loadImage(url, signal);
            } catch (error) {
                if (Date.now() >= deadline) {
                    throw error;
                }
            }
            if (!started) {
                started = true;
                if ((await startRender()) === RenderStatus.NO_PART) {
                    throw new NoPartError();
                }
                // It may have landed between the miss and the start.
                continue;
            }
            // Once more at the deadline, for a push that never reached us.
            if (!waiting.pushed) {
                await sleep(
                    deadline - Date.now(),
                    signal,
                    (next) => (waiting.wake = next)
                );
            }
        }
    } finally {
        stopMessages();
    }
}
