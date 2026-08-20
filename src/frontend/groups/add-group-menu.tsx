import { Button, Group, Menu, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReactNode, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { parseUrl } from "../common/url";
import { getAppErrorHandler, HandledError } from "../api-utils/errors";
import { showInfoToast, showLoadingToast } from "../common/notifications";
import { queryClient } from "../query-client";
import { toLibraryPath, useLibraryId } from "../api-utils/library";
import { jobStatusQueryKey } from "../queries";
import { type JobStatus } from "../../shared/api-models";

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
