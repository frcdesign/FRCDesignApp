import { Button, Dialog, DialogFooter } from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode } from "react";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { router } from "../router";
import { AppDialog, useHandleCloseDialog } from "../api/app-search";
import { useSearch } from "@tanstack/react-router";

export function AdminPanel(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeDialog !== AppDialog.ADMIN_PANEL) {
        return null;
    }
    return <AdminPanelDialog />;
}

function AdminPanelDialog(): ReactNode {
    const closeDialog = useHandleCloseDialog();

    const reloadButton = <ReloadAllDocumentsButton />;
    const actions = <>{reloadButton}</>;
    return (
        <Dialog
            className="admin-panel"
            isOpen
            title="Admin Settings"
            onClose={closeDialog}
        >
            <DialogFooter minimal actions={actions} />
        </Dialog>
    );
}

function ReloadAllDocumentsButton(): ReactNode {
    const mutation = useMutation({
        mutationKey: ["save-all-documents"],
        mutationFn: () => {
            return apiPost("/save-all-documents", {
                // Set a timeout of 5 minutes
                signal: AbortSignal.timeout(5 * 60000)
            });
        },
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ["documents"] });
            router.invalidate(); // Trigger page reload
        }
    });

    return (
        <Button
            icon="refresh"
            text="Reload all documents"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            intent="primary"
        />
    );
}
