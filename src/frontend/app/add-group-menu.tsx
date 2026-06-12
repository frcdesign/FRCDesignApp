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
import { toLibraryPath, useLibraryId } from "../api-utils/library";

function openAddGroupMenu(selectedGroupId?: string) {
    modals.open({
        title: "Add group",
        centered: true,
        children: <AddGroupMenuContent selectedGroupId={selectedGroupId} />
    });
}

interface AddGroupMenuContentProps {
    selectedGroupId?: string;
}

function AddGroupMenuContent(props: AddGroupMenuContentProps): ReactNode {
    const { selectedGroupId } = props;
    const libraryId = useLibraryId();
    const [url, setUrl] = useState("");

    const mutation = useMutation({
        mutationKey: ["add-group"],
        mutationFn: async () => {
            const newDocumentId = parseUrl(url)?.documentId;
            if (!newDocumentId) {
                throw new HandledError("Failed to parse url.");
            }
            showLoadingToast("Adding group...", "add-group");
            modals.closeAll();
            return apiPost("/group" + toLibraryPath(libraryId), {
                body: { newDocumentId, selectedGroupId }
            });
        },
        onError: getAppErrorHandler(
            "Failed to add group. Make sure the document is valid.",
            "add-group"
        ),
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({ queryKey: ["library"] });
            showSuccessToast(`Successfully added ${result.name}.`, "add-group");
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

export function AddGroupButton(): ReactNode {
    return (
        <Button
            leftSection={<IconPlus size={IconSize.SMALL} />}
            onClick={() => openAddGroupMenu()}
        >
            Add group
        </Button>
    );
}

interface AddGroupItemProps {
    selectedGroupId?: string;
}

export function AddGroupItem(props: AddGroupItemProps): ReactNode {
    return (
        <Menu.Item
            leftSection={<IconPlus size={IconSize.SMALL} />}
            onClick={() => openAddGroupMenu(props.selectedGroupId)}
        >
            Add group
        </Menu.Item>
    );
}
