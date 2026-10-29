import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { InsertSource } from "@backend/features/analytics/usage";
import { updateUiState, useUiState } from "../../lib/ui-state";
import { useIsSignedIn } from "../auth/access-level";
import { useLibraryQuery } from "../library/queries";
import { useFavoritesQuery } from "../favorites/queries";
import { openInsertMenu } from "./open-insert-menu";

/** Once per load: a caller who closes the restored menu has closed it. */
let restored = false;

/** Reopens the menu after an Onshape tab switch, a relaunch, or a shared link. */
export function useRestoreInsertMenu(): void {
    const { openInsertableId, openSelection, openFavoriteId } = useUiState(
        useShallow((state) => ({
            openInsertableId: state.openInsertableId,
            openSelection: state.openSelection,
            openFavoriteId: state.openFavoriteId
        }))
    );
    const libraryQuery = useLibraryQuery();
    const favoritesQuery = useFavoritesQuery();
    const isSignedIn = useIsSignedIn();

    useEffect(() => {
        if (restored) {
            return;
        }
        // Staying armed would reopen the first menu the caller opens, on top of itself.
        if (!openInsertableId) {
            restored = true;
            return;
        }
        if (!libraryQuery.isSuccess) {
            return;
        }
        // Signed out, the favorites query stays pending forever.
        if (openFavoriteId && isSignedIn && favoritesQuery.isPending) {
            return;
        }
        restored = true;

        const insertable = libraryQuery.data.insertables[openInsertableId];
        if (!insertable) {
            // Hidden, removed, or from another library.
            updateUiState({
                openInsertableId: undefined,
                openSelection: undefined,
                openFavoriteId: undefined
            });
            return;
        }

        // Someone else's favorite resolves to nothing, leaving the plain menu.
        const favorite = openFavoriteId
            ? favoritesQuery.data?.favorites[openFavoriteId]
            : undefined;

        // The url wins: it's what was on screen.
        openInsertMenu({
            insertable,
            ...(openSelection
                ? { initialSelection: openSelection }
                : {
                      initialSelection: favorite?.defaultSelection,
                      configurationKey: favorite?.configurationKey
                  }),
            favoriteId: favorite?.id,
            source: favorite ? InsertSource.FAVORITES : InsertSource.BROWSE
        });
    }, [
        openInsertableId,
        openSelection,
        openFavoriteId,
        libraryQuery.isSuccess,
        libraryQuery.data,
        favoritesQuery.isPending,
        favoritesQuery.data,
        isSignedIn
    ]);
}
