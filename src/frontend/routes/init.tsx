import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "../query-client";
import { getContextDataQuery } from "../queries";
import { getUiState } from "../api-utils/ui-state";
import { RootAppError } from "../app/root-error";

/**
 * Auth-gated entry point. The backend `GET /init` redirects unauthenticated users
 * to sign-in; once authenticated it serves the SPA here, and we forward to the
 * document list (or the last-open document) with the user's settings in search.
 */
export const Route = createFileRoute("/init")({
    beforeLoad: async () => {
        const { settings } = await queryClient.ensureQueryData(
            getContextDataQuery()
        );
        const search = { settings };
        const uiState = getUiState();
        if (uiState.openDocumentId) {
            throw redirect({
                to: "/app/documents/$documentId",
                params: { documentId: uiState.openDocumentId },
                search
            });
        }
        throw redirect({ to: "/app/documents", search });
    },
    errorComponent: RootAppError
});
