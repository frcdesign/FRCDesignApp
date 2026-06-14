import {
    createFileRoute,
    redirect,
    SearchSchemaInput
} from "@tanstack/react-router";
import { getUiState } from "../api-utils/ui-state";
import { RootAppError } from "../app/root-error";
import { OnshapeParams } from "../api-utils/onshape-params";

export const Route = createFileRoute("/init")({
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        // Rebind theme received from Onshape
        search.systemTheme = search.theme;
        delete search.theme;
        return search as unknown as OnshapeParams;
    },
    beforeLoad: () => {
        const uiState = getUiState();
        if (uiState.openGroupId) {
            throw redirect({
                to: "/app/groups/$groupId",
                params: { groupId: uiState.openGroupId }
            });
        }
        throw redirect({ to: "/app/groups" });
    },
    errorComponent: RootAppError
});
