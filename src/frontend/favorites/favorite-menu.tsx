import { Button, Group, Modal } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";
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
import { ConfigurationWrapper } from "../app/configurations";
import { type FavoritesData } from "../../shared/api-models";
import { HeartIcon } from "./favorite-button";
import { queryClient } from "../query-client";
import { Configuration } from "../../shared/configuration-models";
import {
    favoritesQueryKey,
    useFavoritesQuery,
    useLibraryQuery
} from "../queries";
import { getQueryUpdater } from "../common/utils";
import { useLibrary } from "../api-utils/library";
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
    const insertables = useLibraryQuery().data?.insertables;
    const favoritesData = useFavoritesQuery().data;

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(defaultConfiguration);

    const closeDialog = useHandleCloseDialog();
    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            return apiPost("/default-configuration/" + favoriteId, {
                body: { defaultConfiguration: configuration }
            });
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(library);
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) => {
                    const fav = data.favorites[favoriteId];
                    if (fav) fav.defaultConfiguration = configuration;
                    return data;
                })
            );
            void router.invalidate();
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
            void router.invalidate();
        }
    });

    const favorite = favoritesData?.favorites[favoriteId];
    const insertable =
        favorite && insertables
            ? insertables[favorite.insertableId]
            : undefined;
    if (!insertable) {
        return null;
    }
    if (!insertable.configurationId) {
        return (
            <PageError
                title="Cannot edit unconfigurable favorite"
                description={null}
            />
        );
    }

    return (
        <Modal
            opened
            size={500}
            title={
                <Group gap="xs" wrap="nowrap">
                    <HeartIcon />
                    {insertable.name}
                </Group>
            }
            onClose={closeDialog}
            centered
        >
            <PreviewImageCard
                path={insertable.path}
                configuration={configuration}
            />
            <ConfigurationWrapper
                configuration={configuration}
                setConfiguration={setConfiguration}
                configurationId={insertable.configurationId}
                documentId={insertable.documentId}
            />
            <Group justify="flex-end" mt="md">
                <Button
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={() => {
                        setDefaultConfigurationMutation.mutate();
                        closeDialog();
                    }}
                >
                    Save
                </Button>
            </Group>
        </Modal>
    );
}
