/** The server pushes when a render lands, so a miss waits for that rather than polling. */
import { HttpStatus } from "http-status-ts";
import { DEFAULT_CONFIGURATION_KEY } from "@backend/features/configurations/contract";
import {
    type LiveMessage,
    LiveMessageType
} from "@backend/features/live/contract";
import { parseThumbnailUrl } from "@backend/features/thumbnails/keys";
import { loadImage } from "../../lib/api-client";
import { ImageLoadError } from "../../lib/errors";
import { subscribeLiveMessages } from "../../lib/live-updates";

/** As long as `RenderThumbnailWorkflow` tries. */
const RENDER_TIMEOUT_MS = 60_000;

/** The part didn't regenerate, so no render is coming. */
export function isInvalidConfiguration(error: unknown): boolean {
    return (
        error instanceof ImageLoadError &&
        error.status === HttpStatus.UNPROCESSABLE_ENTITY
    );
}

/** Whether a push says the render `url` serves has landed. */
export function isRenderOf(url: string, message: LiveMessage): boolean {
    if (message.type !== LiveMessageType.THUMBNAIL) {
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

/** Throws once no render is coming. */
export async function loadRenderedImage(
    url: string,
    signal?: AbortSignal
): Promise<string> {
    const deadline = Date.now() + RENDER_TIMEOUT_MS;
    // Subscribed before the first ask, so a push during it isn't missed.
    const waiting = {
        pushed: false,
        wake: undefined as (() => void) | undefined
    };
    const stopMessages = subscribeLiveMessages((message) => {
        if (isRenderOf(url, message)) {
            waiting.pushed = true;
            waiting.wake?.();
        }
    });
    try {
        for (;;) {
            waiting.pushed = false;
            try {
                return await loadImage(url, signal);
            } catch (error) {
                if (isInvalidConfiguration(error) || Date.now() >= deadline) {
                    throw error;
                }
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
