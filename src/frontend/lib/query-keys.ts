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

export function holdNewVersionsQueryKey(libraryId: LibraryId) {
    return ["hold-new-versions", libraryId];
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

export function recentsQueryKey(libraryId: LibraryId) {
    return [...libraryQueryKey(libraryId), "recents"];
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

/** Under the library, so its refresh asks again. */
export function documentChangesQueryKey(
    libraryId: LibraryId,
    documentId: string,
    includeElements?: boolean
) {
    const key = [...libraryQueryKey(libraryId), "document-changes", documentId];
    // Left out, the key is a prefix of the document's queries with and without tabs.
    return includeElements === undefined ? key : [...key, includeElements];
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

/**
 * The version manager's queries, keyed by the workspace they are about and kept
 * outside the library prefix: a library reload moves nothing here.
 */
export function workspaceLinksQueryKey(workspace: InstancePath | undefined) {
    return ["workspace-links", workspace];
}

/** Under the links' key, so whatever refreshes the list refreshes these with it. */
export function workspaceChangesQueryKey(
    workspace: InstancePath | undefined,
    parent: InstancePath
) {
    return [...workspaceLinksQueryKey(workspace), "changes", parent];
}

/** Under the links' key, so a link added or removed asks for them again. */
export function linkSuggestionsQueryKey(workspace: InstancePath | undefined) {
    return [...workspaceLinksQueryKey(workspace), "suggestions"];
}

export function versionJobQueryKey(workspace: InstancePath | undefined) {
    return ["version-job", workspace];
}

/** The name a push would give the version it cuts here, read from Onshape. */
export function nextVersionNameQueryKey(workspace: InstancePath | undefined) {
    return ["next-version-name", workspace];
}
