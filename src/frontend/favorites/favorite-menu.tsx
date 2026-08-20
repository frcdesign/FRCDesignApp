import { Button, Group, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { FontWeight, IconSize } from "../common/style-constants";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { showErrorToast, showSuccessToast } from "../common/notifications";
import { PreviewImageCard } from "../insert/thumbnail";
import { ConfigurationWrapper } from "../insert/configurations";
import { type FavoritesData } from "../../shared/api-models";
import { HeartIcon } from "./favorite-button";
import { queryClient } from "../query-client";
import {
    ParameterValues,
    SearchRecord
} from "../../shared/configuration-models";
import { encodeCanonicalConfiguration } from "../../shared/canonical-configuration";
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
    // Minted here so the content can update the header as the selection changes.
    const modalId = crypto.randomUUID();
    modals.open({
        modalId,
        title: <FavoriteMenuTitle name={insertableName} />,
        size: 500,
        centered: true,
        children: (
            <FavoriteMenuContent
                favoriteId={favoriteId}
                modalId={modalId}
                defaultConfiguration={defaultConfiguration}
            />
        )
    });
}

/** The element's name, and what the saved configuration produces beneath it. */
function FavoriteMenuTitle({
    name,
    record
}: {
    name: string;
    record?: SearchRecord;
}): ReactNode {
    const details = record
        ? [record.partNumber, record.name].filter(
              (value): value is string => !!value && value !== name
          )
        : [];
    return (
        <Group gap="xs" wrap="nowrap">
            <HeartIcon />
            <Stack gap={0}>
                <Text fw={FontWeight.SEMI_BOLD}>{name}</Text>
                {details.length > 0 && (
                    <Text size="xs" c="dimmed">
                        {details.join(" · ")}
                    </Text>
                )}
            </Stack>
        </Group>
    );
}

interface FavoriteMenuContentProps {
    favoriteId: string;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    defaultConfiguration?: ParameterValues;
}

function FavoriteMenuContent(props: FavoriteMenuContentProps): ReactNode {
    const { favoriteId, modalId, defaultConfiguration } = props;

    const router = useRouter();
    const libraryId = useLibraryId();
    const insertables = useLibraryQuery().data?.insertables;
    const favoritesData = useFavoritesQuery().data;
    const refreshFavorites = useRefreshFavorites();

    const [configuration, setConfiguration] = useState<
        ParameterValues | undefined
    >(defaultConfiguration);
    // Reported by ConfigurationWrapper; addresses this selection's thumbnail.
    // Undefined until it reports, which is what gates saving.
    const [canonicalConfiguration, setCanonicalConfiguration] = useState<
        ParameterValues | undefined
    >(undefined);
    const [record, setRecord] = useState<SearchRecord | undefined>(undefined);

    const favorite = favoritesData?.favorites[favoriteId];
    const insertable =
        favorite && insertables
            ? insertables[favorite.insertableId]
            : undefined;

    const insertableName = insertable?.name;
    useEffect(() => {
        if (insertableName === undefined) {
            return;
        }
        modals.updateModal({
            modalId,
            title: <FavoriteMenuTitle name={insertableName} record={record} />
        });
    }, [modalId, insertableName, record]);

    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            // Canonical, so it addresses the thumbnail the favorites row asks
            // for; Onshape applies defaults for what it omits.
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
                insertableId={insertable.id}
                microversionId={insertable.microversionId}
                largeThumbnailUrl={insertable.largeThumbnailUrl}
                canonicalConfiguration={encodeCanonicalConfiguration(
                    canonicalConfiguration ?? {}
                )}
            />
            <ConfigurationWrapper
                onCanonicalConfiguration={setCanonicalConfiguration}
                onRecord={setRecord}
                configuration={configuration}
                setConfiguration={setConfiguration}
                configurationId={insertable.configurationId}
                microversionId={insertable.microversionId}
            />
            <Group justify="flex-end" mt="md">
                <Button
                    leftSection={<IconDeviceFloppy size={IconSize.SMALL} />}
                    // Saving before the wrapper reports would store {}, wiping
                    // the favorite's configuration.
                    disabled={!canonicalConfiguration}
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
