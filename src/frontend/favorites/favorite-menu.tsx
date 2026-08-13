import { Button, Group } from "@mantine/core";
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
import { ParameterValues } from "../../shared/configuration-models";
import { encodeCanonicalConfiguration } from "../../shared/configuration-utils";
import {
    favoritesQueryKey,
    useFavoritesQuery,
    useLibraryQuery
} from "../queries";
import { getQueryUpdater } from "../common/utils";
import { useLibraryId } from "../api-utils/library";
import { useRefreshFavorites } from "../api-utils/refresh";
import { PageError } from "../app-common/app-zero-state";

interface OpenFavoriteMenuProps {
    favoriteId: string;
    insertableName: string;
    defaultConfiguration?: ParameterValues;
}

export function openFavoriteMenu(props: OpenFavoriteMenuProps) {
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
            <FavoriteMenuContent
                favoriteId={favoriteId}
                defaultConfiguration={defaultConfiguration}
            />
        )
    });
}

interface FavoriteMenuContentProps {
    favoriteId: string;
    defaultConfiguration?: ParameterValues;
}

function FavoriteMenuContent(props: FavoriteMenuContentProps): ReactNode {
    const { favoriteId, defaultConfiguration } = props;

    const router = useRouter();
    const libraryId = useLibraryId();
    const insertables = useLibraryQuery().data?.insertables;
    const favoritesData = useFavoritesQuery().data;
    const refreshFavorites = useRefreshFavorites();

    const [configuration, setConfiguration] = useState<
        ParameterValues | undefined
    >(defaultConfiguration);
    // Reported by ConfigurationWrapper; addresses this selection's thumbnail.
    const [canonicalConfiguration, setCanonicalConfiguration] =
        useState<ParameterValues>({});

    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            // Store the canonical form: Onshape applies defaults for whatever
            // it omits, so it inserts the same thing, and it addresses the same
            // thumbnail the favorites row asks for.
            return apiPost("/default-configuration/" + favoriteId, {
                body: { defaultConfiguration: canonicalConfiguration }
            });
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(libraryId);
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) => {
                    const fav = data.favorites[favoriteId];
                    if (fav) fav.defaultConfiguration = canonicalConfiguration;
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
        onSettled: refreshFavorites
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
                microversionId={insertable.microversionId}
                configuration={configuration}
                microversionId={insertable.microversionId}
                canonicalConfiguration={encodeCanonicalConfiguration(
                    canonicalConfiguration
                )}
            />
            <ConfigurationWrapper
                onCanonicalConfiguration={setCanonicalConfiguration}
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
