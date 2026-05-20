import {
    Button,
    ButtonVariant,
    Colors,
    Icon,
    MenuItem
} from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api-utils/api";
import {
    type FavoritesData,
    ElementObj,
    Library
} from "../api-utils/client-models";
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
    element: ElementObj;
}

function updateFavorites(
    data: FavoritesData,
    args: UpdateFavoritesArgs,
    library: Library
): FavoritesData | undefined {
    const elementId = args.element.id;
    if (args.operation === Operation.ADD) {
        data.favorites[elementId] = {
            id: elementId,
            library
        };
        data.favoriteOrder.push(elementId);
    } else {
        delete data.favorites[elementId];
        data.favoriteOrder = data.favoriteOrder.filter(
            (favoriteId: string) => favoriteId !== elementId
        );
    }
    return data;
}

function useUpdateFavoritesMutation(isFavorite: boolean) {
    const library = useLibrary();
    const router = useRouter();
    const queryKey = favoritesQueryKey(library);

    return useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorite", isFavorite],
        mutationFn: async (args) => {
            const query = { elementId: args.element.id };
            const path = "/favorites" + toLibraryPath(library);

            if (args.operation === Operation.ADD) {
                if (!args.element.isVisible) {
                    throw new HandledError(
                        `Cannot favorite hidden element ${args.element.name}.`
                    );
                }
                return apiPost(path, { query });
            } else {
                return apiDelete(path, { query });
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
            router.invalidate();
        },
        onError: (error, args) => {
            const action =
                args.operation === Operation.ADD ? "favorite" : "unfavorite";
            const defaultMessage = `Unexpectedly failed to ${action} ${args.element.name}.`;
            handleAppError(error, defaultMessage);
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey });
            router.invalidate();
        }
    });
}
interface FavoriteButtonProps {
    isFavorite: boolean;
    element: ElementObj;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { isFavorite, element } = props;

    const [isHovered, setIsHovered] = useState(false);
    const mutation = useUpdateFavoritesMutation(isFavorite);

    let favoriteIcon;
    if (isHovered) {
        if (isFavorite) {
            favoriteIcon = <HeartBrokenIcon />;
        } else {
            favoriteIcon = <HeartIcon />;
        }
    } else {
        favoriteIcon = <HeartIcon full={isFavorite} />;
    }

    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;
    return (
        <Button
            icon={favoriteIcon}
            onClick={(event) => {
                event.stopPropagation();
                mutation.mutate({ operation, element });
            }}
            title={operation === Operation.ADD ? "Favorite" : "Unfavorite"}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            variant={ButtonVariant.MINIMAL}
        />
    );
}

interface FavoriteElementItemProps {
    isFavorite: boolean;
    element: ElementObj;
}

/**
 * A menu item which can be used to favorite or unfavorite an element.
 */
export function FavoriteElementItem(props: FavoriteElementItemProps) {
    const { isFavorite, element } = props;
    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;
    const mutation = useUpdateFavoritesMutation(isFavorite);

    return (
        <MenuItem
            text={operation === Operation.ADD ? "Favorite" : "Unfavorite"}
            icon={
                operation === Operation.ADD ? (
                    <HeartIcon />
                ) : (
                    <HeartBrokenIcon />
                )
            }
            onClick={() => {
                mutation.mutate({ operation, element });
            }}
            intent={operation === Operation.ADD ? "none" : "danger"}
        />
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
    return <Icon icon="heart" color={full ? Colors.RED3 : undefined} />;
}

export function HeartBrokenIcon(): ReactNode {
    return <Icon icon="heart-broken" color={Colors.RED3} />;
}
