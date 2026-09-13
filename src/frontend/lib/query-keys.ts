/**
 * Every query key in one place. Everything scoped to a library hangs off
 * {@link libraryQueryKey}, so the refresh flows invalidate that one prefix.
 */
import { LibraryId } from "@backend/features/library/library-id";
import { InstancePath } from "@backend/lib/onshape/path";

export function accessDataQueryKey() {
    return ["access-data"];
}

export function configurationQueryKey(
    insertableId: string,
    microversionId: string
) {
    return ["configuration", insertableId, microversionId];
}

export function unitInfoQueryKey(instancePath: InstancePath) {
    return ["unit-info", instancePath];
}

/** The prefix every library-scoped query extends with its endpoint. */
export function libraryQueryKey(libraryId: LibraryId) {
    return ["library", libraryId];
}

/**
 * The library-scoped queries pinned to a cache version. Their urls are
 * immutable, so one answers for its own version and no other — which is what
 * {@link isVersionedLibraryQuery} exists to keep a refresh from forgetting.
 */
const LIBRARY_DATA = "library-data";
const SEARCH_DB = "search-db";
const BUILD_STATUS = "build-status";

export function libraryDataQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return [...libraryQueryKey(libraryId), LIBRARY_DATA, cacheVersion];
}

export function libraryVersionQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "library-version"];
}

export function searchDbQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return [...libraryQueryKey(libraryId), SEARCH_DB, cacheVersion];
}

export function favoritesQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "favorites"];
}

export function buildStatusQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return [...libraryQueryKey(libraryId), BUILD_STATUS, cacheVersion];
}

/** Whether `queryKey` is one of the version-keyed library queries. */
export function isVersionedLibraryQuery(queryKey: readonly unknown[]): boolean {
    // The name sits where every library key puts it, after the library's id.
    return [LIBRARY_DATA, SEARCH_DB, BUILD_STATUS].includes(
        queryKey[2] as string
    );
}

export function jobStatusQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "job-status"];
}
