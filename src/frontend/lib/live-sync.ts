/** Applies the server's pushes to the cache. Mounted once, by the app shell. */
import { useEffect, useRef } from "react";
import {
    type LiveMessage,
    LiveMessageType
} from "@backend/features/live/contract";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { useAccessData } from "../features/auth/access-level";
import { isRenderOf } from "../features/thumbnails/render-wait";
import { useLibraryId } from "./library";
import {
    connectLiveUpdates,
    isLiveConnected,
    subscribeLiveConnection,
    subscribeLiveMessages
} from "./live-updates";
import { queryClient } from "./query-client";
import { jobStatusQueryKey } from "./query-keys";
import { useRefreshLibrary } from "./refresh";

export function useLiveSync(): void {
    const libraryId = useLibraryId();
    const refreshLibrary = useRefreshLibrary();
    const { signedIn, currentAccessLevel } = useAccessData();
    // Non-editors would otherwise show spinners for work they can't see.
    const showsJobs = signedIn && hasEditorAccess(currentAccessLevel);
    const hasConnected = useRef(false);

    useEffect(() => connectLiveUpdates(libraryId), [libraryId]);

    useEffect(() => {
        const apply = (message: LiveMessage) => {
            switch (message.type) {
                case LiveMessageType.JOBS:
                    if (showsJobs && message.libraryId === libraryId) {
                        queryClient.setQueryData(
                            jobStatusQueryKey(libraryId),
                            message.status
                        );
                    }
                    break;
                case LiveMessageType.LIBRARY:
                    if (message.libraryId === libraryId) {
                        void refreshLibrary();
                    }
                    break;
                case LiveMessageType.THUMBNAIL:
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
        return subscribeLiveMessages(apply);
    }, [libraryId, refreshLibrary, showsJobs]);

    // Pushes during the outage are lost, so a reconnect refetches.
    useEffect(
        () =>
            subscribeLiveConnection(() => {
                if (!isLiveConnected()) {
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
