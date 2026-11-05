import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FavoritesData } from "@backend/features/favorites/contract";
import type { InsertableOut } from "@backend/features/library/contract";
import { DEFAULT_LIBRARY } from "@backend/features/library/library-id";
import { renderWithProviders } from "../../../../__test_utils__/render";
import { favoritesQueryKey } from "../../../lib/query-keys";

// Never answers, so what shows is the optimistic row alone.
const apiPost = vi.hoisted(() => vi.fn(() => new Promise(() => undefined)));
vi.mock("../../../lib/api-client", () => ({ apiPost, apiDelete: vi.fn() }));
vi.mock("../../../lib/library", () => ({
    useLibraryId: () => DEFAULT_LIBRARY
}));
vi.mock("../../../lib/refresh", () => ({
    useRefreshFavorites: () => () => Promise.resolve()
}));

const { FavoriteButton } = await import("./favorite-button");
const { queryClient } = await import("../../../lib/query-client");

const INSERTABLE = {
    id: "ins",
    name: "Hex shaft",
    isVisible: true
} as InsertableOut;

const queryKey = favoritesQueryKey(DEFAULT_LIBRARY);

describe("FavoriteButton", () => {
    afterEach(() => {
        queryClient.clear();
        apiPost.mockClear();
    });

    it("shows a new favorite in the configuration it was favorited with", async () => {
        const user = userEvent.setup();
        queryClient.setQueryData<FavoritesData>(queryKey, {
            favorites: {},
            favoriteOrder: []
        });
        renderWithProviders(
            <FavoriteButton
                favorite={undefined}
                insertable={INSERTABLE}
                selection={{ size: "1/2 in", length: undefined }}
                configurationKey="size=0.0127"
            />
        );

        await user.click(screen.getByRole("button", { name: "Favorite" }));

        const data = queryClient.getQueryData<FavoritesData>(queryKey)!;
        expect(Object.values(data.favorites)).toEqual([
            expect.objectContaining({
                insertableId: "ins",
                defaultSelection: { size: "1/2 in" },
                configurationKey: "size=0.0127"
            })
        ]);
        expect(apiPost).toHaveBeenCalledOnce();
    });
});
