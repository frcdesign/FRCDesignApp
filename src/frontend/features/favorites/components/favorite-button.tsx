import { ActionIcon, Menu } from "@mantine/core";
import { HeartIcon, HeartBreakIcon } from "@phosphor-icons/react";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../../../lib/api-client";
import type {
    Favorite,
    FavoritesData
} from "@backend/features/favorites/contract";
import type { InsertableOut } from "@backend/features/library/contract";
import { LibraryId } from "@backend/features/library/library-id";
import { queryClient } from "../../../lib/query-client";
import { appError, handleAppError } from "../../../lib/errors";
import { getQueryUpdater } from "../../../lib/query-cache";
import {
    toFavoritePath,
    toLibraryPath,
    useLibraryId
} from "../../library/library-path";
import { favoritesQueryKey } from "../../../lib/query-keys";
import { useRefreshFavorites } from "../../../lib/refresh";
import { AppIcon } from "../../../components/app-icon";

enum Operation {
    ADD,
    REMOVE
}

interface UpdateFavoritesArgs {
    operation: Operation;
    insertable: InsertableOut;
    favoriteId: string;
    /** The selection to store, canonical; absent means the element default. */
    canonicalConfiguration?: string;
}

function updateFavorites(
    data: FavoritesData,
    args: UpdateFavoritesArgs,
    libraryId: LibraryId
): FavoritesData | undefined {
    const { favoriteId, canonicalConfiguration } = args;
    const insertableId = args.insertable.id;
    if (args.operation === Operation.ADD) {
        const fav: Favorite = {
            id: favoriteId,
            insertableId,
            libraryId,
            canonicalConfiguration
        };
        data.favorites[favoriteId] = fav;
        data.favoriteOrder.push(favoriteId);
    } else {
        delete data.favorites[favoriteId];
        data.favoriteOrder = data.favoriteOrder.filter(
            (id: string) => id !== favoriteId
        );
    }
    return data;
}

function useUpdateFavoritesMutation() {
    const libraryId = useLibraryId();
    const refreshFavorites = useRefreshFavorites();
    const queryKey = favoritesQueryKey(libraryId);

    return useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorite"],
        mutationFn: async (args) => {
            if (args.operation === Operation.ADD) {
                if (!args.insertable.isVisible) {
                    throw appError(
                        `Cannot favorite hidden element ${args.insertable.name}.`
                    );
                }
                return apiPost("/favorites" + toLibraryPath(libraryId), {
                    query: {
                        insertableId: args.insertable.id,
                        id: args.favoriteId
                    },
                    body: {
                        canonicalConfiguration: args.canonicalConfiguration
                    }
                });
            } else {
                return apiDelete(toFavoritePath(args.favoriteId));
            }
        },
        onMutate: async (args) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(
                queryKey,
                getQueryUpdater((data: FavoritesData) =>
                    updateFavorites(data, args, libraryId)
                )
            );
            // No router.invalidate(): the route loader prefetches favorites,
            // and that fetch would race the mutation and undo this update.
        },
        onError: (error, args) => {
            const action =
                args.operation === Operation.ADD ? "favorite" : "unfavorite";
            handleAppError(
                error,
                `Unexpectedly failed to ${action} ${args.insertable.name}.`
            );
        },
        onSettled: refreshFavorites
    });
}

interface FavoriteButtonProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
    /**
     * The selection the new favorite opens with — what the caller is showing,
     * rather than the element's own default — canonical, as it is stored.
     */
    canonicalConfiguration?: string;
    /**
     * Sizes the button to sit beside a full-height button rather than in a card row.
     * @default false
     */
    large?: boolean;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { favorite, insertable, canonicalConfiguration, large } = props;
    const isFavorite = favorite !== undefined;

    const [isHovered, setIsHovered] = useState(false);
    const mutation = useUpdateFavoritesMutation();

    const iconSize = large ? IconSize.CONTROL : IconSize.SMALL;
    let favoriteIcon;
    if (isHovered) {
        favoriteIcon = isFavorite ? (
            <UnfavoriteIcon size={iconSize} />
        ) : (
            <FavoriteIcon size={iconSize} />
        );
    } else {
        favoriteIcon = <FavoriteIcon full={isFavorite} size={iconSize} />;
    }

    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;

    return (
        <ActionIcon
            variant="subtle"
            color={StatusColor.NEUTRAL}
            size={large ? "input-sm" : undefined}
            onClick={(event) => {
                event.stopPropagation();
                const favoriteId = favorite?.id ?? crypto.randomUUID();
                mutation.mutate({
                    operation,
                    insertable,
                    favoriteId,
                    canonicalConfiguration
                });
            }}
            title={operation === Operation.ADD ? "Favorite" : "Unfavorite"}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {favoriteIcon}
        </ActionIcon>
    );
}

interface FavoriteInsertableItemProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
    /** The selection the new favorite opens with, canonical. */
    canonicalConfiguration?: string;
}

/**
 * A menu item which can be used to favorite or unfavorite an insertable.
 */
export function FavoriteInsertableItem(props: FavoriteInsertableItemProps) {
    const { favorite, insertable, canonicalConfiguration } = props;
    const isFavorite = favorite !== undefined;
    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;
    const mutation = useUpdateFavoritesMutation();

    return (
        <Menu.Item
            leftSection={
                operation === Operation.ADD ? (
                    <FavoriteIcon />
                ) : (
                    <UnfavoriteIcon />
                )
            }
            color={operation === Operation.ADD ? undefined : "red"}
            onClick={() => {
                const favoriteId = favorite?.id ?? crypto.randomUUID();
                mutation.mutate({
                    operation,
                    insertable,
                    favoriteId,
                    canonicalConfiguration
                });
            }}
        >
            {operation === Operation.ADD ? "Favorite" : "Unfavorite"}
        </Menu.Item>
    );
}

interface FavoriteIconProps {
    /**
     * @default true
     */
    full?: boolean;
    /**
     * @default IconSize.SMALL
     */
    size?: IconSize;
}

export function FavoriteIcon(props: FavoriteIconProps): ReactNode {
    const { full = true, size = IconSize.SMALL } = props;
    // fz, not size: Box builds its own `style`, dropping the font-size that
    // Phosphor's `size` sets, which shrank the icon to 1em.
    return full ? (
        <AppIcon
            icon={HeartIcon}
            size={size}
            color={StatusColor.ERROR}
            weight="fill"
        />
    ) : (
        <HeartIcon size={size} />
    );
}

interface UnfavoriteIconProps {
    /**
     * @default IconSize.SMALL
     */
    size?: IconSize;
}

export function UnfavoriteIcon(props: UnfavoriteIconProps): ReactNode {
    const { size = IconSize.SMALL } = props;
    return (
        <AppIcon icon={HeartBreakIcon} size={size} color={StatusColor.ERROR} />
    );
}
