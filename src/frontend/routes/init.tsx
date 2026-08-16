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
        const { libraryId, openGroupId } = getUiState();
        if (openGroupId) {
            throw redirect({
                to: "/app/library/$libraryId/groups/$groupId",
                params: { libraryId, groupId: openGroupId }
            });
        }
        throw redirect({
            to: "/app/library/$libraryId",
            params: { libraryId }
        });
    },
    errorComponent: RootAppError
});
