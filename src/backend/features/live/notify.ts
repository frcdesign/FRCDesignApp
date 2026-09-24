/** A failed push is logged, not thrown: a client that missed it resyncs on reconnect. */
import type { AppBindings } from "../../lib/context";
import type { LibraryId } from "../library/library-id";
import type { JobStatus } from "../load/contract";
import { type LiveMessage, LiveMessageType } from "./contract";

async function broadcast(
    env: AppBindings,
    message: LiveMessage,
    libraryId?: LibraryId
): Promise<void> {
    try {
        await env.LIVE_UPDATES.getByName("all").broadcast(message, libraryId);
    } catch (error) {
        console.error(`Failed to push ${message.type}`, error);
    }
}

/** A library's jobs as they now stand, after one started or finished. */
export function pushJobStatus(
    env: AppBindings,
    libraryId: LibraryId,
    status: JobStatus
): Promise<void> {
    return broadcast(
        env,
        { type: LiveMessageType.JOBS, libraryId, status },
        libraryId
    );
}

/** Tells a library's viewers to move to its new cache version. */
export function pushLibraryChanged(
    env: AppBindings,
    libraryId: LibraryId
): Promise<void> {
    return broadcast(
        env,
        { type: LiveMessageType.LIBRARY, libraryId },
        libraryId
    );
}

export function pushThumbnailRendered(
    env: AppBindings,
    subject: Omit<
        Extract<LiveMessage, { type: LiveMessageType.THUMBNAIL }>,
        "type"
    >
): Promise<void> {
    return broadcast(env, { type: LiveMessageType.THUMBNAIL, ...subject });
}
