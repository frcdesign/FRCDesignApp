import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconRefresh } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { showInfoToast } from "../common/notifications";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { getAppErrorHandler } from "../api-utils/errors";
import { toLibraryPath, useLibraryId } from "../api-utils/library";
import { contextDataQueryKey, libraryQueryMatchKey } from "../queries";
import { refreshLibraryWhenReloadCompletes } from "../api-utils/reload-refresh";

interface ReloadGroupsButtonProps {
    reloadAll?: boolean;
}

export function ReloadGroupsButton(props: ReloadGroupsButtonProps): ReactNode {
    const reloadAll = props.reloadAll ?? false;

    const libraryId = useLibraryId();
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["reload-groups"],
        mutationFn: async () => {
            return apiPost("/reload-groups" + toLibraryPath(libraryId), {
                query: { forceReload: reloadAll }
            });
        },
        onError: getAppErrorHandler("Failed to reload documents!"),
        onSuccess: () => {
            showInfoToast(
                "Initiated workflow, which can take up to 30 minutes."
            );
            // Refresh the library automatically once the reload finishes.
            refreshLibraryWhenReloadCompletes(() => void router.invalidate());
        },
        onSettled: async () => {
            await queryClient.refetchQueries({
                queryKey: contextDataQueryKey()
            });
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
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
