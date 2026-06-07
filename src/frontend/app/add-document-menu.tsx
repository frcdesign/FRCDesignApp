import { Button, Group, Menu, Modal, TextInput } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReactNode, useState } from "react";
import {
    AddDocumentMenuParams,
    MenuType,
    MenuDialogProps,
    useHandleCloseDialog
} from "../overlays/menu-params";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { parseUrl } from "../common/url";
import { getAppErrorHandler, HandledError } from "../api-utils/errors";
import { showLoadingToast, showSuccessToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { toLibraryPath, useLibrary } from "../api-utils/library";

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
    const library = useLibrary();

    const [url, setUrl] = useState("");

    const mutation = useMutation({
        mutationKey: ["add-document"],
        mutationFn: async () => {
            const newDocumentId = parseUrl(url)?.documentId;
            if (!newDocumentId) {
                throw new HandledError("Failed to parse url.");
            }
            showLoadingToast("Adding document...", "add-document");
            closeDialog();
            return apiPost("/document" + toLibraryPath(library), {
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
            await queryClient.invalidateQueries({ queryKey: ["library"] });
            showSuccessToast(
                `Successfully added ${result.name}.`,
                "add-document"
            );
        }
    });

    return (
        <Modal opened onClose={closeDialog} title="Add document" centered>
            <Group align="flex-end" gap="sm" wrap="nowrap">
                <TextInput
                    flex={1}
                    placeholder="Document url..."
                    value={url}
                    onChange={(event) => setUrl(event.currentTarget.value)}
                    error={mutation.isError}
                />
                <Button
                    leftSection={<IconPlus size={IconSize.SMALL} />}
                    onClick={() => {
                        mutation.mutate();
                    }}
                    loading={mutation.isPending}
                >
                    Add
                </Button>
            </Group>
        </Modal>
    );
}

export function AddDocumentButton(): ReactNode {
    const navigate = useNavigate();
    return (
        <Button
            leftSection={<IconPlus size={IconSize.SMALL} />}
            onClick={() => {
                void navigate({
                    to: ".",
                    search: {
                        activeMenu: MenuType.ADD_DOCUMENT_MENU
                    }
                });
            }}
        >
            Add document
        </Button>
    );
}

interface AddDocumentItemProps {
    selectedDocumentId?: string;
}

export function AddDocumentItem(props: AddDocumentItemProps): ReactNode {
    const navigate = useNavigate();
    return (
        <Menu.Item
            leftSection={<IconPlus size={IconSize.SMALL} />}
            onClick={() => {
                void navigate({
                    to: ".",
                    search: {
                        activeMenu: MenuType.ADD_DOCUMENT_MENU,
                        selectedDocumentId: props.selectedDocumentId
                    }
                });
            }}
        >
            Add document
        </Menu.Item>
    );
}
