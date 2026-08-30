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

export function libraryDataQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return [...libraryQueryKey(libraryId), "library-data", cacheVersion];
}

export function libraryVersionQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "library-version"];
}

export function searchDbQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return [...libraryQueryKey(libraryId), "search-db", cacheVersion];
}

export function favoritesQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "favorites"];
}

export function buildStatusQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return [...libraryQueryKey(libraryId), "build-status", cacheVersion];
}

export function jobStatusQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "job-status"];
}
