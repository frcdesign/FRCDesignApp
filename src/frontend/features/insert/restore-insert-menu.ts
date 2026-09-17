import { useEffect } from "react";
import { decodeConfiguration } from "@backend/features/configurations/utils";
import { InsertSource } from "@backend/features/analytics/usage";
import { updateUiState, useGetUiState } from "../../lib/ui-state";
import { useIsSignedIn } from "../auth/access-level";
import { useLibraryQuery } from "../library/queries";
import { useFavoritesQuery } from "../favorites/queries";
import { openInsertMenu } from "./open-insert-menu";

/**
 * Once per load rather than per mount: the menu is reopened because the app
 * started with one recorded, and a caller who then closes it has closed it.
 */
let restored = false;

/**
 * Reopens the insert menu the app was left with — after an Onshape tab switch,
 * a relaunch, or a link somebody shared. Waits for the library, which is what
 * turns the stored id back into a part.
 */
export function useRestoreInsertMenu(): void {
    const { openInsertableId, openConfigurationKey, openFavoriteId } =
        useGetUiState();
    const libraryQuery = useLibraryQuery();
    const favoritesQuery = useFavoritesQuery();
    const isSignedIn = useIsSignedIn();

    useEffect(() => {
        if (restored) {
            return;
        }
        // Nothing was recorded, so there is nothing to wait for. Staying armed
        // instead would have the first menu the caller opens themselves —
        // which writes this same field — reopened on top of itself, leaving a
        // second copy behind when they close the one they can see.
        if (!openInsertableId) {
            restored = true;
            return;
        }
        if (!libraryQuery.isSuccess) {
            return;
        }
        // A favorite is worth waiting for, being what decides how the menu
        // opens; signed out there is nothing coming, and the query stays
        // pending forever.
        if (openFavoriteId && isSignedIn && favoritesQuery.isPending) {
            return;
        }
        restored = true;

        const insertable = libraryQuery.data.insertables[openInsertableId];
        if (!insertable) {
            // The library no longer has it: a part that was hidden or removed,
            // or a link from a library this caller is not in.
            updateUiState({
                openInsertableId: undefined,
                openConfigurationKey: undefined,
                openFavoriteId: undefined
            });
            return;
        }

        // Somebody else's favorite resolves to nothing, which leaves the part
        // and its configuration — the plain insert menu, on the same part.
        const favorite = openFavoriteId
            ? favoritesQuery.data?.favorites[openFavoriteId]
            : undefined;

        openInsertMenu({
            insertable,
            initialSelection: openConfigurationKey
                ? decodeConfiguration(openConfigurationKey)
                : favorite?.defaultSelection,
            configurationKey:
                openConfigurationKey ?? favorite?.configurationKey,
            favoriteId: favorite?.id,
            source: favorite ? InsertSource.FAVORITES : InsertSource.BROWSE
        });
    }, [
        openInsertableId,
        openConfigurationKey,
        openFavoriteId,
        libraryQuery.isSuccess,
        libraryQuery.data,
        favoritesQuery.isPending,
        favoritesQuery.data,
        isSignedIn
    ]);
}
