import {
    Button,
    Dialog,
    DialogBody,
    DialogFooter,
    Intent
} from "@blueprintjs/core";
import { ReactNode, useState } from "react";
import {
    MenuType,
    FavoriteMenuParams,
    MenuDialogProps,
    useHandleCloseDialog
} from "../overlays/menu-params";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { PreviewImageCard } from "../insert/thumbnail";
import { ConfigurationWrapper } from "../configurations/configurations";
import { type FavoritesData } from "../api-utils/client-models";
import { HeartIcon } from "./favorite-button";
import { queryClient } from "../query-client";
import { Configuration } from "../configurations/configuration-models";
import { favoritesQueryKey, useLibraryQuery } from "../queries";
import { getQueryUpdater } from "../common/utils";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { PageError } from "../common/app-zero-state";

export function FavoriteMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== MenuType.FAVORITE_MENU) {
        return null;
    }
    return (
        <FavoriteMenuDialog
            favoriteId={search.favoriteId}
            defaultConfiguration={search.defaultConfiguration}
        />
    );
}

function FavoriteMenuDialog(
    props: MenuDialogProps<FavoriteMenuParams>
): ReactNode {
    const { favoriteId, defaultConfiguration } = props;

    const router = useRouter();
    const library = useLibrary();
    const elements = useLibraryQuery().data?.insertables;

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(defaultConfiguration);

    const closeDialog = useHandleCloseDialog();
    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            return apiPost("/default-configuration" + toLibraryPath(library), {
                body: { favoriteId, defaultConfiguration: configuration }
            });
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(library);
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) => {
                    if (data.favorites[favoriteId]) {
                        data.favorites[favoriteId]!.defaultConfiguration =
                            configuration;
                    }
                    return data;
                })
            );
            router.invalidate();
        },
        onError: () => {
            showErrorToast(
                "Unexpectedly failed to update default configuration."
            );
        },
        onSuccess: () => {
            showSuccessToast("Successfully updated default configuration.");
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: favoritesQueryKey(library)
            });
            router.invalidate();
        }
    });

    const element = elements ? elements[favoriteId] : undefined;
    if (!element) {
        return null;
    }
    if (!element.configurationId) {
        return (
            <PageError
                title="Cannot edit unconfigurable favorite"
                description={null}
            />
        );
    }

    const closeButton = (
        <Button
            text="Save"
            icon="floppy-disk"
            intent={Intent.PRIMARY}
            onClick={() => {
                setDefaultConfigurationMutation.mutate();
                closeDialog();
            }}
        />
    );

    return (
        <Dialog
            isOpen
            icon={<HeartIcon />}
            className="insert-menu"
            title={element.name}
            onClose={closeDialog}
        >
            <PreviewImageCard
                path={element.path}
                configuration={configuration}
            />
            <DialogBody>
                <ConfigurationWrapper
                    configuration={configuration}
                    setConfiguration={setConfiguration}
                    configurationId={element.configurationId}
                    documentId={element.documentId}
                />
            </DialogBody>
            <DialogFooter minimal actions={closeButton} />
        </Dialog>
    );
}
