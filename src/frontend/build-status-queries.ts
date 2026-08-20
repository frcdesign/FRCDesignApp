import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-utils/api";
import { type LibraryBuildStatus } from "../shared/build-status-dto";
import { LibraryId } from "../shared/library-id";
import { useLibraryId } from "./api-utils/library";
import { useCacheVersion } from "./library-queries";
import { buildStatusQueryKey } from "./query-keys";

export function getBuildStatusQuery(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return queryOptions<LibraryBuildStatus>({
        queryKey: buildStatusQueryKey(libraryId, cacheVersion),
        queryFn: () =>
            apiGet("/build-status/library/" + libraryId, {
                cacheId: cacheVersion
            }),
        // A toggle bumps cacheVersion (and thus this key); keep the old data on
        // screen while the new version refetches so the hover card doesn't close.
        placeholderData: keepPreviousData,
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useBuildStatusQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useCacheVersion();
    return useQuery(getBuildStatusQuery(libraryId, cacheVersion));
}
