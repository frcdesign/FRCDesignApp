/**
 * Every query key in one place: features read their own keys here, and the
 * cross-feature refresh flows invalidate by the match keys.
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

export function libraryQueryMatchKey() {
    return ["library"];
}

export function libraryQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return ["library", libraryId, cacheVersion];
}

export function libraryVersionQueryMatchKey() {
    return ["library-version"];
}

export function libraryVersionQueryKey(libraryId: LibraryId) {
    return ["library-version", libraryId];
}

export function searchDbQueryMatchKey() {
    return ["search-db"];
}

export function searchDbQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return ["search-db", libraryId, cacheVersion];
}

export function favoritesQueryKey(libraryId: LibraryId) {
    return ["favorites", libraryId];
}

export function buildStatusQueryMatchKey() {
    return ["build-status"];
}

export function buildStatusQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return ["build-status", libraryId, cacheVersion];
}

export function jobStatusQueryMatchKey() {
    return ["job-status"];
}

export function jobStatusQueryKey(libraryId: LibraryId) {
    return ["job-status", libraryId];
}
