/** A failed push is logged, not thrown: a client that missed it resyncs on reconnect. */
import type { AppBindings } from "../../lib/context";
import type { LibraryId } from "../library/library-id";
import type { JobStatus } from "../load/contract";
import { type PushMessage, PushType, type ThumbnailPush } from "./contract";
import { getPushHub } from "./push-hub";

async function broadcast(
    env: AppBindings,
    message: PushMessage
): Promise<void> {
    try {
        await getPushHub(env).broadcast(message);
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
    return broadcast(env, { type: PushType.JOBS, libraryId, status });
}

/** Tells a library's viewers to move to its new cache version. */
export function pushLibraryChanged(
    env: AppBindings,
    libraryId: LibraryId
): Promise<void> {
    return broadcast(env, { type: PushType.LIBRARY, libraryId });
}

export function pushThumbnailRendered(
    env: AppBindings,
    thumbnail: Omit<ThumbnailPush, "type">
): Promise<void> {
    return broadcast(env, { type: PushType.THUMBNAIL, ...thumbnail });
}
