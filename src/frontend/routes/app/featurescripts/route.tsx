import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UtilityTab } from "../../../lib/app-tab";
import { updateUiState } from "../../../lib/ui-state";
import { loadFeatureScripts } from "../../../features/featurescripts/queries";

export const Route = createFileRoute("/app/featurescripts")({
    component: Outlet,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.FEATURESCRIPTS });
    },
    loader: loadFeatureScripts
});
