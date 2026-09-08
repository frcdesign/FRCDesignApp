import { modals } from "@mantine/modals";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useMenuTitle } from "../../../components/app-title";
import { Button } from "@mantine/core";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { ReactNode, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../../../lib/api-client";
import { showErrorToast, showSuccessToast } from "../../../lib/notifications";
import { PreviewImageCard } from "../../thumbnails/components/thumbnail";
import { ConfigurationWrapper } from "../../insert/components/configurations";
import type { FavoritesData } from "@backend/features/favorites/contract";
import { FavoriteIcon } from "./favorite-button";
import { queryClient } from "../../../lib/query-client";
import {
    Selection,
    SearchRecord
} from "@backend/features/configurations/models";
import { ELEMENT_DEFAULT_KEY } from "@backend/features/configurations/selection";
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
    /** What the favorite opens with today. */
    initialSelection?: Selection;
}

/**
 * Saves what the favorite opens with. Takes its key too, so the
 * cached row names the right thumbnail before the refetch answers.
 */
function useSetDefaultConfigurationMutation(
    favoriteId: string,
    selection: Selection | undefined,
    configurationKey: string | undefined
) {
    const libraryId = useLibraryId();
    const refreshFavorites = useRefreshFavorites();
    return useMutation({
        mutationKey: ["set-default-selection"],
        mutationFn: async () => {
            // The whole selection, not its key: the key names only what the
            // selection overrides, and the favorite opens on all of it.
            return apiPost("/default-selection" + toFavoritePath(favoriteId), {
                body: { selection: selection }
            });
        },
        onMutate: async () => {
            const queryKey = favoritesQueryKey(libraryId);
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) => {
                    const fav = data.favorites[favoriteId];
                    if (fav) {
                        fav.defaultSelection = selection;
                        fav.configurationKey = configurationKey;
                    }
                    return data;
                })
            );
            // No router.invalidate(): the route loader prefetches favorites,
            // and that fetch would race the mutation and undo this update.
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update default selection.");
        },
        onSuccess: () => {
            showSuccessToast("Successfully updated default selection.");
        },
        onSettled: refreshFavorites
    });
}

export function FavoriteMenuContent(
    props: FavoriteMenuContentProps
): ReactNode {
    const { favoriteId, modalId, initialSelection } = props;

    const insertables = useLibraryQuery().data?.insertables;
    const favoritesData = useFavoritesQuery().data;

    const [selection, setSelection] = useState<Selection | undefined>(
        initialSelection
    );
    // Reported by ConfigurationWrapper; names this selection's thumbnail.
    // Undefined until it reports, which is what gates saving.
    const [configurationKey, setConfigurationKey] = useState<string>();
    const [record, setRecord] = useState<SearchRecord | undefined>(undefined);

    const favorite = favoritesData?.favorites[favoriteId];
    const insertable =
        favorite && insertables
            ? insertables[favorite.insertableId]
            : undefined;

    useMenuTitle(modalId, {
        name: insertable?.name,
        record,
        icon: <FavoriteIcon size={IconSize.MEDIUM} />
    });

    const setDefaultConfigurationMutation = useSetDefaultConfigurationMutation(
        favoriteId,
        selection,
        configurationKey
    );

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
                    configurationKey={configurationKey ?? ELEMENT_DEFAULT_KEY}
                />
                <ConfigurationWrapper
                    onConfigurationKey={setConfigurationKey}
                    onRecord={setRecord}
                    selection={selection}
                    setSelection={setSelection}
                    insertableId={insertable.id}
                    microversionId={insertable.microversionId}
                />
            </AppModalBody>
            <AppModalFooter>
                <Button
                    ml="auto"
                    leftSection={<FloppyDiskIcon size={IconSize.SMALL} />}
                    // Saving before the wrapper reports would store nothing,
                    // wiping the favorite's selection.
                    disabled={configurationKey === undefined}
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
