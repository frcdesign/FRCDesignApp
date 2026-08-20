import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconRefresh } from "@tabler/icons-react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode } from "react";
import { showInfoToast } from "../../../lib/notifications";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../../../lib/api-client";
import { queryClient } from "../../../lib/query-client";
import { getAppErrorHandler } from "../../../lib/errors";
import { toLibraryPath, useLibraryId } from "../library-path";
import { jobStatusQueryKey } from "../../../lib/query-keys";
import type { JobStatus } from "@backend/features/library/dto";

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
            // Seeding rather than invalidating shows the spinner without waiting
            // for a round trip.
            const justStarted: JobStatus = { running: true, runningForMs: 0 };
            queryClient.setQueryData<JobStatus>(
                jobStatusQueryKey(libraryId),
                justStarted
            );
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
