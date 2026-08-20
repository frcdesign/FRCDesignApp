import {
    keepPreviousData,
    queryOptions,
    useQuery
} from "@tanstack/react-query";
import { apiGet } from "../../lib/api-client";
import { type LibraryBuildStatus } from "@backend/features/build-checker/dto";
import { LibraryId } from "@backend/features/library/library-id";
import { useLibraryId } from "../library/library-path";
import { useCacheVersion } from "../library/queries";
import { buildStatusQueryKey } from "../../lib/query-keys";

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
