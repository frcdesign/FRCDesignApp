import { Button, Group, Menu, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReactNode, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { parseUrl } from "../common/url";
import { getAppErrorHandler, HandledError } from "../api-utils/errors";
import { showLoadingToast, showSuccessToast } from "../common/toaster";
import { queryClient } from "../query-client";
import { toLibraryPath, useLibrary } from "../api-utils/library";

function openAddDocumentMenu(selectedDocumentId?: string) {
    modals.open({
        title: "Add document",
        centered: true,
        children: (
            <AddDocumentMenuContent selectedDocumentId={selectedDocumentId} />
        )
    });
}

interface AddDocumentMenuContentProps {
    selectedDocumentId?: string;
}

function AddDocumentMenuContent(props: AddDocumentMenuContentProps): ReactNode {
    const { selectedDocumentId } = props;
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
            modals.closeAll();
            return apiPost("/document" + toLibraryPath(library), {
                body: { newDocumentId, selectedDocumentId }
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
                onClick={() => mutation.mutate()}
                loading={mutation.isPending}
            >
                Add
            </Button>
        </Group>
    );
}

export function AddDocumentButton(): ReactNode {
    return (
        <Button
            leftSection={<IconPlus size={IconSize.SMALL} />}
            onClick={() => openAddDocumentMenu()}
        >
            Add document
        </Button>
    );
}

interface AddDocumentItemProps {
    selectedDocumentId?: string;
}

export function AddDocumentItem(props: AddDocumentItemProps): ReactNode {
    return (
        <Menu.Item
            leftSection={<IconPlus size={IconSize.SMALL} />}
            onClick={() => openAddDocumentMenu(props.selectedDocumentId)}
        >
            Add document
        </Menu.Item>
    );
}
