import { Button, Dialog, DialogFooter } from "@blueprintjs/core";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ReactNode } from "react";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { router } from "../router";

export function AdminPanel() {
    const navigate = useNavigate();

    const reloadButton = <ReloadAllDocumentsButton />;

    const actions = <>{reloadButton}</>;

    return (
        <Dialog
            isOpen
            title="Admin Settings"
            onClose={() => navigate({ to: ".." })}
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
