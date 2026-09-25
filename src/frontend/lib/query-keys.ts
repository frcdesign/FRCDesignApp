/** Library-scoped keys hang off {@link libraryQueryKey}, so a refresh invalidates one prefix. */
import { LibraryId } from "@backend/features/library/library-id";
import { ElementPath, InstancePath } from "@backend/lib/onshape/path";

/** Access is per library; without one, the prefix every library's shares. */
export function accessDataQueryKey(libraryId?: LibraryId) {
    return libraryId ? ["access-data", libraryId] : ["access-data"];
}

export function adminTeamQueryKey(libraryId: LibraryId) {
    return ["admin-team", libraryId];
}

export function versionApprovalQueryKey(libraryId: LibraryId) {
    return ["version-approval", libraryId];
}

export function configurationQueryKey(
    insertableId: string,
    microversionId: string
) {
    return ["configuration", insertableId, microversionId];
}

export function unitInfoQueryKey(instancePath: InstancePath | undefined) {
    return ["unit-info", instancePath];
}

export function insertLocationQueryKey(elementPath: ElementPath | undefined) {
    return ["insert-location", elementPath];
}

/** The prefix every library-scoped query extends with its endpoint. */
export function libraryQueryKey(libraryId: LibraryId) {
    return ["library", libraryId];
}

/** Immutable urls; see {@link isVersionedLibraryQuery}. */
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

/** Inserting cancels everything under this prefix. */
const RENDER = "thumbnail";

export function renderQueryPrefix() {
    return [RENDER];
}

export function renderQueryKey(url: string) {
    return [RENDER, url];
}

/** Bytes already stored, which a row and its hover card read. */
export function storedThumbnailQueryKey(url: string | undefined) {
    return ["storage-thumbnail", url];
}
