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
            // Show the running spinner immediately rather than on the next poll;
            // the navbar watcher refreshes the library when it finishes.
            void queryClient.invalidateQueries({
                queryKey: jobStatusQueryKey(libraryId)
            });
            if (data.status === "already-running") {
                showInfoToast("A reload is already running.");
            }
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
