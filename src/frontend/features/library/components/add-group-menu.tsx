import { Button, Group, Menu, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Plus } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../../../lib/api-client";
import { parseUrl } from "../../../lib/url";
import { getAppErrorHandler, HandledError } from "../../../lib/errors";
import { showInfoToast, showLoadingToast } from "../../../lib/notifications";
import { queryClient } from "../../../lib/query-client";
import { toLibraryPath, useLibraryId } from "../library-path";
import { jobStatusQueryKey } from "../../../lib/query-keys";
import type { JobStatus } from "@backend/features/load/contract";

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
            showLoadingToast("Adding document...", "add-group");
            modals.closeAll();
            return apiPost("/group" + toLibraryPath(libraryId), {
                body: { newDocumentId, selectedGroupId }
            });
        },
        onError: getAppErrorHandler(
            "Failed to add document. Make sure the document is valid.",
            "add-group"
        ),
        onSuccess: () => {
            showInfoToast("Adding document...", "add-group");
            // Starts the job poll, which stays idle until something is known to
            // be running, and shows the spinner without waiting for a request.
            const justStarted: JobStatus = { running: true, runningForMs: 0 };
            queryClient.setQueryData<JobStatus>(
                jobStatusQueryKey(libraryId),
                justStarted
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
                leftSection={<Plus size={IconSize.SMALL} />}
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
            leftSection={<Plus size={IconSize.SMALL} />}
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
            leftSection={<Plus size={IconSize.SMALL} />}
            onClick={() => openAddGroupMenu(props.selectedGroupId)}
        >
            Add group
        </Menu.Item>
    );
}
