import { Button, ButtonVariant, Colors, Icon } from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api/api";
import { copyUserData, ElementObj, UserData } from "../api/models";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { showErrorToast } from "../common/toaster";
import { useSearch } from "@tanstack/react-router";
import { router } from "../router";

enum Operation {
    ADD,
    REMOVE
}

interface UpdateFavoritesArgs {
    operation: Operation;
    elementId: string;
}

function updateFavorites(data: UserData, args: UpdateFavoritesArgs): UserData {
    const newUserData = copyUserData(data);
    if (args.operation === Operation.ADD) {
        newUserData.favorites[args.elementId] = {
            id: args.elementId
        };
        newUserData.favoriteOrder.push(args.elementId);
    } else {
        delete newUserData.favorites[args.elementId];
        newUserData.favoriteOrder = newUserData.favoriteOrder.filter(
            (favoriteId) => favoriteId !== args.elementId
        );
    }
    return newUserData;
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
            console.log("Mutate?");
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
            queryClient.setQueryData(["user-data"], (data: UserData) =>
                updateFavorites(data, args)
            );
            router.invalidate();
        },
        onError: (_error, args) => {
            const action =
                args.operation === Operation.ADD ? "favorite" : "unfavorite";
            showErrorToast(`Unexpectedly failed to ${action} ${element.name}.`);
            queryClient.refetchQueries({ queryKey: ["user-data"] });
            router.invalidate();
        }
    });

    const [isHovered, setIsHovered] = useState(false);

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
