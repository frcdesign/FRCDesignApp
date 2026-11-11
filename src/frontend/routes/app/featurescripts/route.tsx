import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UtilityTab } from "../../../lib/app-tab";
import { queryClient } from "../../../lib/query-client";
import { updateUiState } from "../../../lib/ui-state";
import {
    getFeatureScriptsQuery,
    getFeatureScriptsVersionQuery
} from "../../../features/featurescripts/queries";

export const Route = createFileRoute("/app/featurescripts")({
    component: Outlet,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.FEATURESCRIPTS });
    },
    loader: async () => {
        // The only awaited fetch: the list keys its url off the version.
        const cacheVersion = await queryClient.ensureQueryData(
            getFeatureScriptsVersionQuery()
        );
        void queryClient.prefetchQuery(getFeatureScriptsQuery(cacheVersion));
    }
});
