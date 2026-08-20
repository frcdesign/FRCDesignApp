import { ActionIcon, Menu } from "@mantine/core";
import {
    IconHeart,
    IconHeartBroken,
    IconHeartFilled
} from "@tabler/icons-react";
import { HeartIconColor, IconSize } from "../common/style-constants";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api-utils/api";
import type { Favorite, FavoritesData } from "../../shared/favorites-dto";
import type { InsertableOut } from "../../shared/library-dto";
import { LibraryId } from "../../shared/library-id";
import { queryClient } from "../query-client";
import { useRouter } from "@tanstack/react-router";
import { handleAppError, HandledError } from "../api-utils/errors";
import { getQueryUpdater } from "../common/utils";
import { toLibraryPath, useLibraryId } from "../api-utils/library";
import { favoritesQueryKey } from "../query-keys";
import { useRefreshFavorites } from "../api-utils/refresh";

enum Operation {
    ADD,
    REMOVE
}

interface UpdateFavoritesArgs {
    operation: Operation;
    insertable: InsertableOut;
    favoriteId: string;
}

function updateFavorites(
    data: FavoritesData,
    args: UpdateFavoritesArgs,
    libraryId: LibraryId
): FavoritesData | undefined {
    const { favoriteId } = args;
    const insertableId = args.insertable.id;
    if (args.operation === Operation.ADD) {
        const fav: Favorite = { id: favoriteId, insertableId, libraryId };
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
    const router = useRouter();
    const refreshFavorites = useRefreshFavorites();
    const queryKey = favoritesQueryKey(libraryId);

    return useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorite"],
        mutationFn: async (args) => {
            if (args.operation === Operation.ADD) {
                if (!args.insertable.isVisible) {
                    throw new HandledError(
                        `Cannot favorite hidden element ${args.insertable.name}.`
                    );
                }
                return apiPost("/favorites" + toLibraryPath(libraryId), {
                    query: {
                        insertableId: args.insertable.id,
                        id: args.favoriteId
                    }
                });
            } else {
                return apiDelete("/favorites/" + args.favoriteId);
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
            void router.invalidate();
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
     * Sizes the button to sit beside a full-height button rather than in a card row.
     * @default false
     */
    large?: boolean;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { favorite, insertable, large } = props;
    const isFavorite = favorite !== undefined;

    const [isHovered, setIsHovered] = useState(false);
    const mutation = useUpdateFavoritesMutation();

    const iconSize = large ? IconSize.CONTROL : IconSize.SMALL;
    let favoriteIcon;
    if (isHovered) {
        favoriteIcon = isFavorite ? (
            <HeartBrokenIcon size={iconSize} />
        ) : (
            <HeartIcon size={iconSize} />
        );
    } else {
        favoriteIcon = <HeartIcon full={isFavorite} size={iconSize} />;
    }

    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;

    return (
        <ActionIcon
            variant="subtle"
            color="gray"
            size={large ? "input-sm" : undefined}
            onClick={(event) => {
                event.stopPropagation();
                const favoriteId = favorite?.id ?? crypto.randomUUID();
                mutation.mutate({ operation, insertable, favoriteId });
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
}

/**
 * A menu item which can be used to favorite or unfavorite an insertable.
 */
export function FavoriteInsertableItem(props: FavoriteInsertableItemProps) {
    const { favorite, insertable } = props;
    const isFavorite = favorite !== undefined;
    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;
    const mutation = useUpdateFavoritesMutation();

    return (
        <Menu.Item
            leftSection={
                operation === Operation.ADD ? (
                    <HeartIcon />
                ) : (
                    <HeartBrokenIcon />
                )
            }
            color={operation === Operation.ADD ? undefined : "red"}
            onClick={() => {
                const favoriteId = favorite?.id ?? crypto.randomUUID();
                mutation.mutate({ operation, insertable, favoriteId });
            }}
        >
            {operation === Operation.ADD ? "Favorite" : "Unfavorite"}
        </Menu.Item>
    );
}

interface HeartIconProps {
    /**
     * @default true
     */
    full?: boolean;
    /**
     * @default IconSize.SMALL
     */
    size?: IconSize;
}

export function HeartIcon(props: HeartIconProps): ReactNode {
    const { full = true, size = IconSize.SMALL } = props;
    return full ? (
        <IconHeartFilled size={size} color={HeartIconColor} />
    ) : (
        <IconHeart size={size} />
    );
}

interface HeartBrokenIconProps {
    /**
     * @default IconSize.SMALL
     */
    size?: IconSize;
}

export function HeartBrokenIcon(props: HeartBrokenIconProps): ReactNode {
    const { size = IconSize.SMALL } = props;
    return <IconHeartBroken size={size} color={HeartIconColor} />;
}
