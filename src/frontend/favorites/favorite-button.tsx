import { ActionIcon } from "@mantine/core";
import {
    IconHeart,
    IconHeartBroken,
    IconHeartFilled
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { AppMenuItem } from "../common/app-menu";
import { apiDelete, apiPost } from "../api-utils/api";
import {
    type Favorite,
    type FavoritesData,
    type InsertableOut
} from "../../shared/api-models";
import { Library } from "../../shared/types";
import { queryClient } from "../query-client";
import { useRouter } from "@tanstack/react-router";
import { handleAppError, HandledError } from "../api-utils/errors";
import { getQueryUpdater } from "../common/utils";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import { favoritesQueryKey } from "../queries";

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
    library: Library
): FavoritesData | undefined {
    const { favoriteId } = args;
    const insertableId = args.insertable.id;
    if (args.operation === Operation.ADD) {
        const fav: Favorite = { id: favoriteId, insertableId, library };
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
    const library = useLibrary();
    const router = useRouter();
    const queryKey = favoritesQueryKey(library);

    return useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorite"],
        mutationFn: async (args) => {
            if (args.operation === Operation.ADD) {
                if (!args.insertable.isVisible) {
                    throw new HandledError(
                        `Cannot favorite hidden element ${args.insertable.name}.`
                    );
                }
                return apiPost("/favorites" + toLibraryPath(library), {
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
                    updateFavorites(data, args, library)
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
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey });
            void router.invalidate();
        }
    });
}

interface FavoriteButtonProps {
    favorite: Favorite | undefined;
    insertable: InsertableOut;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { favorite, insertable } = props;
    const isFavorite = favorite !== undefined;

    const [isHovered, setIsHovered] = useState(false);
    const mutation = useUpdateFavoritesMutation();

    let favoriteIcon;
    if (isHovered) {
        favoriteIcon = isFavorite ? <HeartBrokenIcon /> : <HeartIcon />;
    } else {
        favoriteIcon = <HeartIcon full={isFavorite} />;
    }

    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;

    return (
        <ActionIcon
            variant="subtle"
            color="gray"
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
        <AppMenuItem
            icon={
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
        </AppMenuItem>
    );
}

interface HeartIconProps {
    /**
     * @default true
     */
    full?: boolean;
}

export function HeartIcon(props: HeartIconProps): ReactNode {
    const full = props.full ?? true;
    return full ? (
        <IconHeartFilled size={16} color="var(--mantine-color-red-6)" />
    ) : (
        <IconHeart size={16} />
    );
}

export function HeartBrokenIcon(): ReactNode {
    return <IconHeartBroken size={16} color="var(--mantine-color-red-6)" />;
}
