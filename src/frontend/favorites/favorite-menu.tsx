import { Button, Group, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { ReactNode, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { showErrorToast, showSuccessToast } from "../common/notifications";
import { PreviewImageCard } from "../insert/thumbnail";
import { ConfigurationWrapper } from "../insert/configurations";
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
import { useLibraryId } from "../api-utils/library";
import { PageError } from "../app-common/app-zero-state";

interface OpenFavoriteMenuProps {
    favoriteId: string;
    insertableName: string;
    defaultConfiguration?: Configuration;
    favoriteName?: string;
}

export function openDefaultConfigurationMenu(props: OpenFavoriteMenuProps) {
    const { favoriteId, insertableName, defaultConfiguration } = props;
    modals.open({
        title: (
            <Group gap="xs" wrap="nowrap">
                <HeartIcon />
                {insertableName}
            </Group>
        ),
        size: 500,
        centered: true,
        children: (
            <DefualtConfigurationMenuContent
                favoriteId={favoriteId}
                defaultConfiguration={defaultConfiguration}
            />
        )
    });
}

interface defualtConfigurationMenuContentProps {
    favoriteId: string;
    defaultConfiguration?: Configuration;
}

function DefualtConfigurationMenuContent(
    props: defualtConfigurationMenuContentProps
): ReactNode {
    const { favoriteId, defaultConfiguration } = props;

    const router = useRouter();
    const libraryId = useLibraryId();
    const insertables = useLibraryQuery().data?.insertables;
    const favoritesData = useFavoritesQuery().data;

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(defaultConfiguration);

    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            return apiPost("/favorite-config/" + favoriteId, {
                body: { defaultConfiguration: configuration }
            });
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(libraryId);
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
                queryKey: favoritesQueryKey(libraryId)
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
        <>
            <PreviewImageCard
                path={insertable.path}
                configuration={configuration}
            />
            <ConfigurationWrapper
                configuration={configuration}
                setConfiguration={setConfiguration}
                configurationId={insertable.configurationId}
                microversionId={insertable.microversionId}
            />
            <Group justify="flex-end" mt="md">
                <Button
                    leftSection={<IconDeviceFloppy size={IconSize.SMALL} />}
                    onClick={() => {
                        setDefaultConfigurationMutation.mutate();
                        modals.closeAll();
                    }}
                >
                    Save
                </Button>
            </Group>
        </>
    );
}

export function openFavoriteNameMenu(props: OpenFavoriteMenuProps) {
    const { favoriteId, insertableName, favoriteName } = props;
    modals.open({
        title: (
            <Group gap="xs" wrap="nowrap">
                <HeartIcon />
                {insertableName}
            </Group>
        ),
        size: 500,
        centered: true,
        children: (
            <FavoriteNameMenuContent
                favoriteId={favoriteId}
                favoriteName={favoriteName}
            />
        )
    });
}
interface favoriteNameMenuContentProps {
    favoriteId: string;
    favoriteName?: string;
}
function FavoriteNameMenuContent(
    props: favoriteNameMenuContentProps
): ReactNode {
    const { favoriteId, favoriteName } = props;

    const router = useRouter();
    const libraryId = useLibraryId();

    const [name, setName] = useState(favoriteName ?? "");

    const setFavoriteNameMutation = useMutation({
        mutationKey: ["set-favorite-name", favoriteId],
        mutationFn: async () => {
            return apiPost(
                "/favorite-config/" +
                    favoriteId +
                    "/" +
                    encodeURIComponent(name),
                {
                    body: {}
                }
            );
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(libraryId);
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) => {
                    const fav = data.favorites[favoriteId];
                    if (fav) fav.favoriteName = name;
                    return data;
                })
            );
            void router.invalidate();
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update favorite name.");
        },
        onSuccess: () => {
            showSuccessToast("Successfully updated favorite name.");
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: favoritesQueryKey(libraryId)
            });
            void router.invalidate();
        }
    });

    return (
        <>
            <TextInput
                label="Favorite name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Enter a custom favorite name"
                mb="md"
            />
            <Group justify="flex-end">
                <Button
                    leftSection={<IconDeviceFloppy size={IconSize.SMALL} />}
                    onClick={() => {
                        setFavoriteNameMutation.mutate();
                        modals.closeAll();
                    }}
                    disabled={name.trim().length === 0}
                >
                    Save
                </Button>
            </Group>
        </>
    );
}
