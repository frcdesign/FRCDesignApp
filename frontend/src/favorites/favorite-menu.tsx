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
    AppMenu,
    FavoriteMenuParams,
    MenuDialogProps,
    useHandleCloseDialog
} from "../api/menu-params";
import { useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { PreviewImage } from "./thumbnail";
import { useElementsQuery } from "../queries";
import { ConfigurationWrapper } from "../insert/configurations";
import { Configuration, UserData } from "../api/models";
import { AppInternalErrorState } from "../common/app-zero-state";
import { HeartIcon } from "./favorite-button";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { router } from "../router";

export function FavoriteMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.FAVORITE_MENU) {
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
    const elements = useElementsQuery().data;

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
            await queryClient.cancelQueries({ queryKey: ["user-data"] });
            const previousUserData = queryClient.getQueryData(["user-data"]);
            queryClient.setQueryData(["user-data"], (oldData: UserData) => {
                const newUserData = { ...oldData };
                if (newUserData.favorites[favoriteId]) {
                    newUserData.favorites[favoriteId].defaultConfiguration =
                        configuration;
                }
                return newUserData;
            });
            return { previousUserData };
        },
        onError: () => {
            showErrorToast(
                "Unexpectedly failed to update default configuration."
            );
            queryClient.invalidateQueries({ queryKey: ["user-data"] });
            router.invalidate();
        },
        onSuccess: () => {
            showSuccessToast("Successfully updated default configuration.");
        }
    });

    if (!elements) {
        return null;
    }
    const element = elements[favoriteId];
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
