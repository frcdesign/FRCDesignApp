/**
 * The app's own url parameters, beside the ones Onshape launches with: what is
 * being searched, and the part the insert menu has open.
 *
 * The url is adopted once, on the load that carries it, so a link opens what it
 * points at. After that the stored state is what the app reads, and every
 * change is mirrored back — so the url a caller copies is the one they are
 * looking at, and a relaunch that carries no parameters resumes from the store.
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as z from "zod";
import { updateUiState, useGetUiState } from "./ui-state";

export const AppParamsType = z.object({
    /** The search box's query. */
    q: z.string().optional().catch(undefined),
    /** The insertable whose insert menu is open. */
    part: z.string().optional().catch(undefined),
    /** Its configuration; absent for the element's own defaults. */
    config: z.string().optional().catch(undefined),
    /** The favorite the menu was opened from, when it was opened from one. */
    favorite: z.string().optional().catch(undefined)
});

export type AppParams = z.infer<typeof AppParamsType>;

/** Kept across in-app navigation, like the parameters Onshape launched with. */
export const APP_PARAM_KEYS = ["q", "part", "config", "favorite"] as const;

/**
 * Once per load, not per navigation: `beforeLoad` runs on every one of them,
 * and re-reading the url after the mirror wrote it would undo nothing useful
 * while making the url the source of truth for the rest of the session.
 */
let adopted = false;

/** Takes what the url names into the stored state, leaving the rest alone. */
export function adoptAppParams(params: AppParams): void {
    if (adopted) {
        return;
    }
    adopted = true;
    updateUiState({
        ...(params.q !== undefined && { searchQuery: params.q }),
        // A part names the whole menu, so its configuration and favorite come
        // with it — including when they are absent, which is a plain part.
        ...(params.part !== undefined && {
            openInsertableId: params.part,
            openConfigurationKey: params.config,
            openFavoriteId: params.favorite
        })
    });
}

/** Writes the stored state back to the url, whenever it changes. */
export function useAppParamMirror(): void {
    const navigate = useNavigate();
    const {
        searchQuery,
        openInsertableId,
        openConfigurationKey,
        openFavoriteId
    } = useGetUiState();

    useEffect(() => {
        void navigate({
            to: ".",
            // The url trails the app rather than being navigated to: a typed
            // query should not be a page to go back through.
            replace: true,
            search: (previous: AppParams) => ({
                ...previous,
                // Empty reads as absent: a parameter with nothing in it is
                // noise in a url somebody is about to copy.
                q: searchQuery || undefined,
                part: openInsertableId,
                config: openConfigurationKey || undefined,
                favorite: openFavoriteId
            })
        });
    }, [
        navigate,
        searchQuery,
        openInsertableId,
        openConfigurationKey,
        openFavoriteId
    ]);
}
