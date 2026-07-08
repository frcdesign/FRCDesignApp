import { describe, expect, it } from "vitest";
import { LibraryId } from "../../shared/types";
import type { Favorite } from "../../shared/api-models";
import { filterFavoritesForSearch } from "./favorite-search";

describe("filterFavoritesForSearch", () => {
    it("matches favorites by their own name and id instead of the insertable name or id", () => {
        const favorites: Favorite[] = [
            {
                id: "fav-1",
                insertableId: "insertable-1",
                libraryId: LibraryId.FRC_DESIGN_LIB,
                name: "My Favorite Wheel"
            },
            {
                id: "custom-favorite-id",
                insertableId: "insertable-2",
                libraryId: LibraryId.FRC_DESIGN_LIB,
                name: "Unrelated"
            }
        ];

        expect(
            filterFavoritesForSearch(favorites, "wheel").map(
                (result) => result.favorite.id
            )
        ).toEqual(["fav-1"]);

        expect(
            filterFavoritesForSearch(
                [
                    {
                        id: "fav-2",
                        insertableId: "insertable-3",
                        libraryId: LibraryId.FRC_DESIGN_LIB,
                        name: "Linear (REV)"
                    }
                ],
                "linear rev"
            ).map((result) => result.favorite.id)
        ).toEqual(["fav-2"]);

        expect(
            filterFavoritesForSearch(favorites, "custom").map(
                (result) => result.favorite.id
            )
        ).toEqual(["custom-favorite-id"]);

        expect(
            filterFavoritesForSearch(favorites, "different-insertable")
        ).toEqual([]);
    });
});
