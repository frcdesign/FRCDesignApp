import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconRefresh } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReactNode } from "react";
import { showInfoToast } from "../common/notifications";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { getAppErrorHandler } from "../api-utils/errors";
import { toLibraryPath, useLibraryId } from "../api-utils/library";
import { jobStatusQueryKey } from "../queries";
import { type JobStatus } from "../../shared/api-models";

interface ReloadGroupsButtonProps {
    reloadAll?: boolean;
}

export function ReloadGroupsButton(props: ReloadGroupsButtonProps): ReactNode {
    const reloadAll = props.reloadAll ?? false;

    const libraryId = useLibraryId();

    const mutation = useMutation({
        mutationKey: ["reload-groups"],
        mutationFn: (): Promise<{ status: string }> => {
            return apiPost("/reload-groups" + toLibraryPath(libraryId), {
                query: { forceReload: reloadAll }
            });
        },
        onError: getAppErrorHandler("Failed to reload documents!"),
        onSuccess: (data) => {
            // Seeding the status (rather than invalidating) both shows the
            // spinner immediately and starts the poll, which stays idle until
            // something is known to be running. The navbar watcher refreshes
            // and reports completion when it finishes.
            queryClient.setQueryData<JobStatus>(jobStatusQueryKey(libraryId), {
                running: true,
                runningForMs: 0
            });
            showInfoToast(
                data.status === "already-running"
                    ? "A reload is already running."
                    : "Reloading documents..."
            );
        }
    });

    const handleClick = () => {
        modals.openConfirmModal({
            title: reloadAll
                ? "Reload all documents"
                : "Reload outdated documents",
            children:
                "Are you sure you want to reload" +
                (reloadAll ? " all documents?" : " outdated documents?"),
            labels: { confirm: "Reload documents", cancel: "Cancel" },
            confirmProps: {
                variant: "light",
                color: reloadAll ? "red" : "blue"
            },
            onConfirm: () => mutation.mutate()
        });
    };

    return (
        <Button
            variant="light"
            color={reloadAll ? "red" : "blue"}
            leftSection={<IconRefresh size={IconSize.SMALL} />}
            onClick={handleClick}
            loading={mutation.isPending}
        >
            Reload documents
        </Button>
    );
}
