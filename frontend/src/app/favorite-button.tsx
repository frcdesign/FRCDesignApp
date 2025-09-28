import { Button, ButtonVariant, Colors, Icon } from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api/api";
import { ElementObj, FavoritesResult } from "../api/models";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { showErrorToast } from "../common/toaster";
import { useSearch } from "@tanstack/react-router";

enum Operation {
    ADD,
    REMOVE
}

function getOppositeOperation(operation: Operation) {
    return operation == Operation.ADD ? Operation.REMOVE : Operation.ADD;
}

interface UpdateFavoritesArgs {
    operation: Operation;
    elementId: string;
}

function updateFavorites(
    data: FavoritesResult,
    args: UpdateFavoritesArgs
): FavoritesResult {
    const newFavorites = {
        favorites: { ...data.favorites },
        favoriteOrder: data.favoriteOrder
    };
    if (args.operation === Operation.ADD) {
        newFavorites.favorites[args.elementId] = { id: args.elementId };
        newFavorites.favoriteOrder.push(args.elementId);
    } else {
        delete newFavorites.favorites[args.elementId];
        newFavorites.favoriteOrder = newFavorites.favoriteOrder.filter(
            (favoriteId) => favoriteId !== args.elementId
        );
    }
    return newFavorites;
}

interface FavoriteButtonProps {
    isFavorite: boolean;
    element: ElementObj;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { isFavorite, element } = props;
    const search = useSearch({ from: "/app" });

    const mutation = useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorites", isFavorite],
        mutationFn: async (args) => {
            const query = { elementId: args.elementId };
            if (args.operation === Operation.ADD) {
                return apiPost("/favorites" + toUserApiPath(search), {
                    query
                });
            } else {
                return apiDelete("/favorites" + toUserApiPath(search), {
                    query
                });
            }
        },
        onMutate: (args) => {
            queryClient.setQueryData(["favorites"], (data: FavoritesResult) =>
                updateFavorites(data, args)
            );
        },
        onError: (_error, args) => {
            const action =
                args.operation === Operation.ADD ? "favorite" : "unfavorite";
            showErrorToast(`Unexpectedly failed to ${action} ${element.name}.`);
            args.operation = getOppositeOperation(args.operation);
            queryClient.refetchQueries({ queryKey: ["favorites"] });
        }
    });

    const [isHovered, setIsHovered] = useState(false);

    let favoriteIcon;
    if (isHovered) {
        if (isFavorite) {
            favoriteIcon = <Icon icon="heart-broken" color={Colors.RED3} />;
        } else {
            favoriteIcon = <FavoriteIcon />;
        }
    } else {
        favoriteIcon = <FavoriteIcon isFavorite={isFavorite} />;
    }

    const operation = isFavorite ? Operation.REMOVE : Operation.ADD;
    const args = {
        operation,
        elementId: element.elementId
    };

    return (
        <Button
            icon={favoriteIcon}
            onClick={(event) => {
                event.stopPropagation();
                mutation.mutate(args);
            }}
            title={operation === Operation.ADD ? "Favorite" : "Unfavorite"}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            variant={ButtonVariant.MINIMAL}
        />
    );
}

interface FavoriteIconProps {
    isFavorite?: boolean;
}

export function FavoriteIcon(props: FavoriteIconProps): ReactNode {
    const isFavorite = props.isFavorite ?? true;
    return (
        <Icon
            icon="heart"
            className={isFavorite ? "" : "empty-heart-icon"}
            color={isFavorite ? Colors.RED3 : undefined}
        />
    );
}
