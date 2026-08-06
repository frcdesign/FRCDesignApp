import { describe, expect, it } from "vitest";
import { LibraryId, Vendor } from "../../shared/types";
import type { Favorite, InsertableOut } from "../../shared/api-models";
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

    it("falls back to the insertable name when the favorite has no custom name", () => {
        const favorites: Favorite[] = [
            {
                id: "fav-3",
                insertableId: "insertable-3",
                libraryId: LibraryId.FRC_DESIGN_LIB
            }
        ];

        const insertables = {
            "insertable-3": {
                name: "Wheel Assembly",
                vendors: [Vendor.REV]
            } as InsertableOut
        };

        expect(
            filterFavoritesForSearch(favorites, "assembly", insertables).map(
                (result) => result.favorite.id
            )
        ).toEqual(["fav-3"]);
    });

    it("filters favorites by vendor when a vendor filter is active", () => {
        const favorites: Favorite[] = [
            {
                id: "fav-rev",
                insertableId: "insertable-rev",
                libraryId: LibraryId.FRC_DESIGN_LIB
            },
            {
                id: "fav-vex",
                insertableId: "insertable-vex",
                libraryId: LibraryId.FRC_DESIGN_LIB
            }
        ];

        const insertables = {
            "insertable-rev": {
                name: "REV Wheel",
                vendors: [Vendor.REV]
            } as InsertableOut,
            "insertable-vex": {
                name: "VEX Wheel",
                vendors: [Vendor.VEX]
            } as InsertableOut
        };

        expect(
            filterFavoritesForSearch(favorites, "wheel", insertables, [
                Vendor.REV
            ]).map((result) => result.favorite.id)
        ).toEqual(["fav-rev"]);
    });
});
