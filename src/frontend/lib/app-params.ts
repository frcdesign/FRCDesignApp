/**
 * The url is adopted once, so a link opens what it points at. After that the
 * stored state is the source of truth and is mirrored back, so a copied url
 * matches the screen.
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import * as z from "zod";
import { updateUiState, useUiState } from "./ui-state";

export const AppParamsType = z.object({
    /** The search box's query. */
    q: z.string().optional().catch(undefined),
    /** The insertable whose insert menu is open. */
    part: z.string().optional().catch(undefined),
    /** Its selection, as entered. */
    config: z.partialRecord(z.string(), z.string()).optional().catch(undefined),
    /** The favorite the menu was opened from, when it was opened from one. */
    favorite: z.string().optional().catch(undefined)
});

export type AppParams = z.infer<typeof AppParamsType>;

/** Kept across in-app navigation, like the parameters Onshape launched with. */
export const APP_PARAM_KEYS = ["q", "part", "config", "favorite"] as const;

/** Takes what the url names into the stored state, leaving the rest alone. */
export function adoptAppParams(params: AppParams): void {
    updateUiState({
        ...(params.q !== undefined && { searchQuery: params.q }),
        // A part names the whole menu, so absent fields mean a plain part.
        ...(params.part !== undefined && {
            openInsertableId: params.part,
            openSelection: params.config,
            openFavoriteId: params.favorite
        })
    });
}

/** Writes the stored state back to the url, whenever it changes. */
export function useAppParamMirror(): void {
    const navigate = useNavigate();
    const { searchQuery, openInsertableId, openSelection, openFavoriteId } =
        useUiState(
            useShallow((state) => ({
                searchQuery: state.searchQuery,
                openInsertableId: state.openInsertableId,
                openSelection: state.openSelection,
                openFavoriteId: state.openFavoriteId
            }))
        );

    useEffect(() => {
        void navigate({
            to: ".",
            // A typed query shouldn't be history to go back through.
            replace: true,
            search: (previous: AppParams) => ({
                ...previous,
                q: searchQuery || undefined,
                part: openInsertableId,
                config: openSelection,
                favorite: openFavoriteId
            })
        });
    }, [
        navigate,
        searchQuery,
        openInsertableId,
        openSelection,
        openFavoriteId
    ]);
}
