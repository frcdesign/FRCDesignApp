import { modals } from "@mantine/modals";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { MenuTitle } from "../../../components/app-title";
import { Button } from "@mantine/core";
import { FloppyDisk } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../../../lib/api-client";
import { showErrorToast, showSuccessToast } from "../../../lib/notifications";
import { PreviewImageCard } from "../../thumbnails/components/thumbnail";
import { ConfigurationWrapper } from "../../insert/components/configurations";
import type { FavoritesData } from "@backend/features/favorites/contract";
import { HeartIcon } from "./favorite-button";
import { queryClient } from "../../../lib/query-client";
import {
    ParameterValues,
    SearchRecord
} from "@backend/features/configurations/models";
import { encodeCanonicalConfiguration } from "@backend/features/configurations/canonical";
import { useFavoritesQuery } from "../queries";
import { useLibraryQuery } from "../../library/queries";
import { favoritesQueryKey } from "../../../lib/query-keys";
import { getQueryUpdater } from "../../../lib/query-cache";
import { toFavoritePath, useLibraryId } from "../../library/library-path";
import { useRefreshFavorites } from "../../../lib/refresh";
import { PageError } from "../../../components/app-zero-state";

interface FavoriteMenuContentProps {
    favoriteId: string;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    defaultConfiguration?: ParameterValues;
}

export function FavoriteMenuContent(
    props: FavoriteMenuContentProps
): ReactNode {
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
            title: (
                <MenuTitle
                    name={insertableName}
                    record={record}
                    icon={<HeartIcon size={IconSize.MEDIUM} />}
                />
            )
        });
    }, [modalId, insertableName, record]);

    const setDefaultConfigurationMutation = useMutation({
        mutationKey: ["set-default-configuration"],
        mutationFn: async () => {
            // Canonical, so it addresses the thumbnail the favorites row asks
            // for; Onshape applies defaults for what it omits.
            return apiPost(
                "/default-configuration" + toFavoritePath(favoriteId),
                {
                    body: { defaultConfiguration: canonicalConfiguration }
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
    if (!insertable.isConfigurable) {
        return (
            <PageError
                title="Cannot edit unconfigurable favorite"
                description={null}
            />
        );
    }

    return (
        <>
            <AppModalBody>
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
                    insertableId={insertable.id}
                    microversionId={insertable.microversionId}
                />
            </AppModalBody>
            <AppModalFooter>
                <Button
                    ml="auto"
                    leftSection={<FloppyDisk size={IconSize.SMALL} />}
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
            </AppModalFooter>
        </>
    );
}
