/**
 * Queries for getting data from various endpoints on the backend.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
import { apiGet } from "./api-utils/api";
import {
    type FavoritesData,
    type LibraryBuildStatus,
    type LibraryOut
} from "../shared/api-models";
import { LibraryId } from "../shared/types";
import { ContextData } from "../shared/types";
import { useLibraryId } from "./api-utils/library";
import { type UnitInfo } from "../shared/configuration-models";
import MiniSearch from "minisearch";
import { SEARCH_OPTIONS } from "../shared/build-insertable-search";
import { InstancePath } from "../shared/onshape-path";

export function getConfigurationMatchKey() {
    return ["configuration"];
}

export function getConfigurationKey(
    configurationId?: string,
    microversionId?: string
) {
    return ["configuration", configurationId, microversionId];
}

export function libraryQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return ["library", libraryId, cacheVersion];
}

export function libraryQueryMatchKey() {
    return ["library"];
}

export function getLibraryQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<LibraryOut>({
        queryKey: libraryQueryKey(libraryId, cacheVersion),
        queryFn: async () =>
            apiGet("/library-data/library/" + libraryId, {
                cacheId: cacheVersion
            }),
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useLibraryQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useQuery(getLibraryQuery(libraryId, cacheVersion));
}

export function contextDataQueryKey() {
    return ["context-data"];
}

/** Returns core application context data needed to load most other endpoints. */
export function getContextDataQuery() {
    return queryOptions<ContextData>({
        queryKey: contextDataQueryKey(),
        queryFn: () => apiGet("/context-data")
    });
}

/** Returns information needed to format unit expressions in the Insert dialog. */
export function useUnitInfoQuery(instancePath: InstancePath) {
    return useQuery<UnitInfo>({
        queryKey: ["unit-info", instancePath],
        queryFn: () =>
            apiGet("/unit-info", {
                query: {
                    documentId: instancePath.documentId,
                    instanceId: instancePath.instanceId,
                    instanceType: instancePath.instanceType
                }
            })
    });
}

export function searchDbQueryMatchKey() {
    return ["search-db"];
}

export function searchDbQueryKey(libraryId: LibraryId, cacheVersion: number) {
    return ["search-db", libraryId, cacheVersion];
}

export function getSearchDbQuery(libraryId: LibraryId, cacheVersion: number) {
    return queryOptions<MiniSearch | null>({
        queryKey: searchDbQueryKey(libraryId, cacheVersion),
        queryFn: async () =>
            apiGet("/search-db/library/" + libraryId, {
                cacheId: cacheVersion
            }).then((result: { searchDb: string | null }) => {
                if (!result.searchDb) return null;
                return MiniSearch.loadJSON(result.searchDb, SEARCH_OPTIONS);
            }),
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useSearchDbQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useQuery(getSearchDbQuery(libraryId, cacheVersion));
}

export function favoritesQueryKey(libraryId: LibraryId) {
    return ["favorites", libraryId];
}

export function getFavoritesQuery(libraryId: LibraryId) {
    return queryOptions<FavoritesData>({
        queryKey: favoritesQueryKey(libraryId),
        queryFn: () => apiGet("/favorites/library/" + libraryId)
    });
}

export function buildStatusQueryKey(
    libraryId: LibraryId,
    cacheVersion: number
) {
    return ["build-status", libraryId, cacheVersion];
}

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
        staleTime: Infinity,
        gcTime: Infinity
    });
}

export function useBuildStatusQuery() {
    const libraryId = useLibraryId();
    const cacheVersion = useLoaderData({ from: "/app" }).accessData
        .cacheVersion;
    return useQuery(getBuildStatusQuery(libraryId, cacheVersion));
}

export function useFavoritesQuery() {
    const libraryId = useLibraryId();
    return useQuery(getFavoritesQuery(libraryId));
}
