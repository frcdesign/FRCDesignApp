import { describe, expect, it } from "vitest";
import {
    buildStatusQueryKey,
    favoritesQueryKey,
    isVersionedLibraryQuery,
    jobStatusQueryKey,
    libraryDataQueryKey,
    libraryVersionQueryKey,
    searchDbQueryKey
} from "./query-keys";
import { LibraryId } from "@backend/features/library/library-id";

const LIBRARY = Object.values(LibraryId)[0];

describe("isVersionedLibraryQuery", () => {
    // Immutable urls: refetching would serve the old version's answer.
    it.each([
        ["library data", libraryDataQueryKey(LIBRARY, 3)],
        ["search db", searchDbQueryKey(LIBRARY, 3)],
        ["build status", buildStatusQueryKey(LIBRARY, 3)]
    ])("holds for %s", (_name, key) => {
        expect(isVersionedLibraryQuery(key)).toBe(true);
    });

    it.each([
        ["favorites", favoritesQueryKey(LIBRARY)],
        ["job status", jobStatusQueryKey(LIBRARY)],
        ["library version", libraryVersionQueryKey(LIBRARY)]
    ])("does not hold for %s", (_name, key) => {
        expect(isVersionedLibraryQuery(key)).toBe(false);
    });

    it("does not hold for a key outside the library prefix", () => {
        expect(isVersionedLibraryQuery(["access-data"])).toBe(false);
    });
});
