import {
    Button,
    Dialog,
    DialogBody,
    Icon,
    InputGroup,
    Intent,
    MenuItem
} from "@blueprintjs/core";
import { ReactNode, useState } from "react";
import {
    AddDocumentMenuParams,
    MenuType,
    MenuDialogProps,
    useHandleCloseDialog
} from "../search-params/menu-params";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { parseUrl } from "../common/url";
import { getAppErrorHandler, HandledError } from "../api/errors";
import { showLoadingToast, showSuccessToast } from "../common/toaster";
import { queryClient } from "../query-client";

export function AddDocumentMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== MenuType.ADD_DOCUMENT_MENU) {
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
        onError: getAppErrorHandler(
            "Failed to add document. Make sure it's valid.",
            "add-document"
        ),
        onSuccess: async (result) => {
            queryClient.invalidateQueries({ queryKey: ["library"] });
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

export function AddDocumentButton(): ReactNode {
    const navigate = useNavigate();
    return (
        <Button
            icon="add"
            text="Add document"
            intent="primary"
            onClick={() => {
                navigate({
                    to: ".",
                    search: {
                        activeMenu: MenuType.ADD_DOCUMENT_MENU
                    }
                });
            }}
        />
    );
}

interface AddDocumentItemProps {
    selectedDocumentId?: string;
}

export function AddDocumentItem(props: AddDocumentItemProps): ReactNode {
    const navigate = useNavigate();
    return (
        <MenuItem
            icon="add"
            text="Add document"
            labelElement={<Icon icon="share" />}
            intent="primary"
            onClick={() => {
                navigate({
                    to: ".",
                    search: {
                        activeMenu: MenuType.ADD_DOCUMENT_MENU,
                        selectedDocumentId: props.selectedDocumentId
                    }
                });
            }}
        />
    );
}
