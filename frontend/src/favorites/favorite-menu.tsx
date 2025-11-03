import {
    Button,
    Card,
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
} from "../search-params/menu-params";
import { useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { PreviewImage } from "./thumbnail";
import { ConfigurationWrapper } from "../insert/configurations";
import { LibraryUserData } from "../api/models";
import { AppInternalErrorState } from "../common/app-zero-state";
import { HeartIcon } from "./favorite-button";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { router } from "../router";
import { Configuration } from "../insert/configuration-models";
import { produce } from "immer";
import { useLibraryQuery } from "../queries";

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

    const search = useSearch({ from: "/app" });
    const elements = useLibraryQuery().data?.elements;

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(defaultConfiguration);

    const closeDialog = useHandleCloseDialog();
    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            return apiPost("/default-configuration" + toUserApiPath(search), {
                body: {
                    favoriteId,
                    defaultConfiguration: configuration
                }
            });
        },
        onMutate: async () => {
            await queryClient.cancelQueries({
                queryKey: ["library-user-data"]
            });
            queryClient.setQueryData(
                ["library-user-data"],
                produce((data?: LibraryUserData) => {
                    if (!data) {
                        return undefined;
                    }
                    if (data.favorites[favoriteId]) {
                        data.favorites[favoriteId].defaultConfiguration =
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
                queryKey: ["library-user-data"]
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
            <AppInternalErrorState title="Cannot edit unconfigurable favorite." />
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
            <Card className="center preview-image-card">
                <PreviewImage
                    elementPath={element}
                    configuration={configuration}
                />
            </Card>
            <DialogBody>
                <ConfigurationWrapper
                    configuration={configuration}
                    setConfiguration={setConfiguration}
                    configurationId={element.configurationId}
                />
            </DialogBody>
            <DialogFooter minimal actions={closeButton} />
        </Dialog>
    );
}
