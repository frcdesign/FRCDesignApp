import {
    Button,
    Dialog,
    DialogBody,
    DialogFooter,
    Intent
} from "@blueprintjs/core";
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

    const body = (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <ReloadAllDocumentsButton force />
            <ReloadAllDocumentsButton />
            <RebuildSearchIndexButton />
        </div>
    );
    const closeButton = (
        <Button
            text="Close"
            icon="cross"
            intent={Intent.SUCCESS}
            onClick={closeDialog}
        />
    );
    return (
        <Dialog
            className="admin-panel"
            isOpen
            title="Admin Settings"
            onClose={closeDialog}
        >
            <DialogBody>{body}</DialogBody>
            <DialogFooter minimal actions={closeButton} />
        </Dialog>
    );
}

interface ReloadAllDocumentsButtonProps {
    force?: boolean;
}

function ReloadAllDocumentsButton(
    props: ReloadAllDocumentsButtonProps
): ReactNode {
    const force = props.force ?? false;
    const mutation = useMutation({
        mutationKey: ["save-all-documents"],
        mutationFn: () => {
            return apiPost("/save-all-documents", {
                // Set a timeout of 5 minutes
                query: { force: force.toString() },
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
            text={force ? "Force reload all documents" : "Reload all documents"}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            intent="primary"
        />
    );
}

function RebuildSearchIndexButton(): ReactNode {
    const mutation = useMutation({
        mutationKey: ["rebuild-search-index"],
        mutationFn: () => {
            return apiPost("/rebuild-search-index", {
                // Set a timeout of 5 minutes
                signal: AbortSignal.timeout(5 * 60000)
            });
        }
    });

    return (
        <Button
            icon="refresh"
            text="Rebuild search index"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            intent="primary"
        />
    );
}
