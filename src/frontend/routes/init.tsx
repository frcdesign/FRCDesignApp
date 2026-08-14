import {
    createFileRoute,
    redirect,
    SearchSchemaInput
} from "@tanstack/react-router";
import { getUiState } from "../api-utils/ui-state";
import { RootAppError } from "../app/root-error";
import { OnshapeParams } from "../api-utils/onshape-params";
import { queryClient } from "../query-client";
import { getContextDataQuery } from "../queries";

export const Route = createFileRoute("/init")({
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        // Rebind theme received from Onshape
        search.systemTheme = search.theme;
        delete search.theme;
        return search as unknown as OnshapeParams;
    },
    beforeLoad: async () => {
        const { settings } = await queryClient.ensureQueryData(
            getContextDataQuery()
        );
        const libraryId = settings.libraryId;
        const uiState = getUiState();
        if (uiState.openGroupId) {
            throw redirect({
                to: "/app/library/$libraryId/$groupId",
                params: { libraryId, groupId: uiState.openGroupId }
            });
        }
        throw redirect({
            to: "/app/library/$libraryId",
            params: { libraryId }
        });
    },
    errorComponent: RootAppError
});
