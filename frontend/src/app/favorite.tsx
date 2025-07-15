import { Button, ButtonVariant, Colors, Icon } from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api/api";
import { ElementObj, FavoritesResult } from "../api/backend-types";
import { useOnshapeData } from "../api/onshape-data";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { showErrorToast } from "./toaster";

enum Operation {
    ADD,
    REMOVE
}

interface UpdateFavoritesArgs {
    operation: Operation;
    elementId: string;
}

function updateFavorites(data: FavoritesResult, args: UpdateFavoritesArgs) {
    const favorites = { ...data };
    if (args.operation === Operation.ADD) {
        favorites[args.elementId] = {};
    } else {
        delete favorites[args.elementId];
    }
    return favorites;
}

interface FavoriteButtonProps {
    isFavorite: boolean;
    element: ElementObj;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { isFavorite, element } = props;
    const onshapeData = useOnshapeData();

    const mutation = useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorites", isFavorite],
        mutationFn: (args) => {
            const query = { elementId: args.elementId };
            if (args.operation === Operation.ADD) {
                return apiPost("/favorites" + toUserApiPath(onshapeData), {
                    query
                });
            } else {
                return apiDelete(
                    "/favorites" + toUserApiPath(onshapeData),
                    query
                );
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
            args.operation =
                args.operation === Operation.ADD
                    ? Operation.REMOVE
                    : Operation.ADD;
            queryClient.setQueryData(["favorites"], (data: FavoritesResult) =>
                updateFavorites(data, args)
            );
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
