import { createFileRoute, redirect } from "@tanstack/react-router";
import { UtilityTab } from "../../lib/app-tab";
import { getUiLibraryId } from "../../lib/library";
import { toTargetElement } from "../../lib/onshape-launch";
import { useOnshapeLaunch } from "../../lib/onshape-params";
import { updateUiState } from "../../lib/ui-state";
import { DesignCheckPage } from "../../features/design-check/components/design-check-page";

export const Route = createFileRoute("/app/design-check")({
    component: DesignCheckPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.DESIGN_CHECK });
    },
    beforeLoad: () => {
        // The page picker hides this page without a tab to check, so this only
        // catches a url typed or restored by hand.
        if (!toTargetElement(useOnshapeLaunch.getState())) {
            throw redirect({
                to: "/app/library/$libraryId",
                params: { libraryId: getUiLibraryId() },
                replace: true
            });
        }
    }
});
