/** Applies the server's pushes to the cache. Mounted once, by the app shell. */
import { useEffect, useRef } from "react";
import { type PushMessage, PushType } from "@backend/features/push/contract";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { useAccessData } from "../features/auth/access-level";
import { isRenderOf } from "../features/thumbnails/render-wait";
import { useLibraryId } from "./library";
import {
    connectPushes,
    subscribePushConnection,
    subscribePushes
} from "./push-socket";
import { queryClient } from "./query-client";
import { jobStatusQueryKey } from "./query-keys";
import { useRefreshLibrary } from "./refresh";

export function usePushSync(): void {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    const { signedIn, currentAccessLevel } = useAccessData();
    // Non-editors would otherwise show spinners for work they can't see.
    const showsJobs = signedIn && hasEditorAccess(currentAccessLevel);
    const hasConnected = useRef(false);

    useEffect(() => connectPushes(libraryId), [libraryId]);

    useEffect(() => {
        const apply = (message: PushMessage) => {
            switch (message.type) {
                case PushType.JOBS:
                    if (showsJobs && message.libraryId === libraryId) {
                        queryClient.setQueryData(
                            jobStatusQueryKey(libraryId),
                            message.status
                        );
                    }
                    break;
                case PushType.LIBRARY:
                    if (message.libraryId === libraryId) {
                        void refreshLibrary();
                    }
                    break;
                case PushType.THUMBNAIL:
                    // Rows that took a miss; anything waiting on the render hears the push itself.
                    void queryClient.refetchQueries({
                        predicate: (query) => {
                            const [kind, url] = query.queryKey;
                            return (
                                kind === "storage-thumbnail" &&
                                typeof url === "string" &&
                                query.state.status === "error" &&
                                isRenderOf(url, message)
                            );
                        }
                    });
                    break;
            }
        };
        return subscribePushes(apply);
    }, [libraryId, refreshLibrary, showsJobs]);

    // Pushes during the outage are lost, so a reconnect refetches.
    useEffect(
        () =>
            subscribePushConnection((connected) => {
                if (!connected) {
                    return;
                }
                if (hasConnected.current) {
                    void refreshLibrary();
                }
                hasConnected.current = true;
            }),
        [refreshLibrary]
    );
}
