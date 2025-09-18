import {
    Button,
    Dialog,
    DialogBody,
    InputGroup,
    Intent
} from "@blueprintjs/core";
import { ReactNode, useState } from "react";
import {
    AddDocumentMenuParams,
    AppMenu,
    MenuDialogProps,
    useHandleCloseDialog
} from "../api/menu-params";
import { useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { parseUrl } from "../common/url";
import { HandledError } from "../api/errors";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast
} from "../common/toaster";
import { queryClient } from "../query-client";
import { invalidateSearchDb } from "../api/search";

export function AddDocumentMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.ADD_DOCUMENT_MENU) {
        return null;
    }
    return (
        <AddDocumentMenuDialog selectedDocumentId={search.selectedDocumentId} />
    );
}

function AddDocumentMenuDialog(
    props: MenuDialogProps<AddDocumentMenuParams>
): ReactNode {
    const { selectedDocumentId } = props;

    const closeDialog = useHandleCloseDialog();

    const [url, setUrl] = useState("");

    const mutation = useMutation({
        mutationKey: ["add-document"],
        mutationFn: async () => {
            const newDocumentId = parseUrl(url)?.documentId;
            if (!newDocumentId) {
                throw new HandledError("Failed to parse document id.");
            }
            showLoadingToast("Adding document...", "add-document");
            closeDialog();
            return apiPost("/document", {
                body: {
                    newDocumentId,
                    selectedDocumentId
                }
            });
        },
        onError: (error) => {
            if (error instanceof HandledError) {
                showErrorToast(error.message, "add-document");
            } else {
                showErrorToast(
                    "Failed to add document. Make sure it's valid.",
                    "add-document"
                );
            }
        },
        onSuccess: async (result) => {
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["documents"] }),
                queryClient.refetchQueries({ queryKey: ["document-order"] }),
                queryClient.refetchQueries({ queryKey: ["elements"] })
            ]);
            invalidateSearchDb();

            showSuccessToast(
                `Successfully added ${result.name}.`,
                "add-document"
            );
        }
    });

    const submitButton = (
        <Button
            text="Add"
            icon="add"
            intent={Intent.PRIMARY}
            onClick={() => {
                mutation.mutate();
            }}
            loading={mutation.isPending}
        />
    );

    const body = (
        <div style={{ display: "flex", gap: "10px" }}>
            <InputGroup
                placeholder="Document url..."
                value={url}
                onValueChange={setUrl}
                intent={mutation.isError ? "danger" : undefined}
                fill
            />
            {submitButton}
        </div>
    );

    return (
        <Dialog isOpen icon="add" title="Add document" onClose={closeDialog}>
            <DialogBody>{body}</DialogBody>
            {/* <DialogFooter minimal actions={submitButton} /> */}
        </Dialog>
    );
}
