import {
    Button,
    ButtonVariant,
    Colors,
    Icon,
    MenuItem
} from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api/api";
import { ElementObj, LibraryUserData } from "../api/models";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { useSearch } from "@tanstack/react-router";
import { router } from "../router";
import { handleAppError, HandledError } from "../api/errors";
import { getQueryUpdater } from "../common/utils";
import { toLibraryPath, useLibrary } from "../api/library";
import { libraryUserDataQueryKey } from "../queries";

enum Operation {
    ADD,
    REMOVE
}

interface UpdateFavoritesArgs {
    operation: Operation;
    element: ElementObj;
}

function updateFavorites(
    data: LibraryUserData,
    args: UpdateFavoritesArgs
): LibraryUserData | undefined {
    const elementId = args.element.id;
    if (args.operation === Operation.ADD) {
        data.favorites[elementId] = {
            id: elementId
        };
        data.favoriteOrder.push(elementId);
    } else {
        delete data.favorites[elementId];
        data.favoriteOrder = data.favoriteOrder.filter(
            (favoriteId) => favoriteId !== elementId
        );
    }
    return data;
}

function useUpdateFavoritesMutation(isFavorite: boolean) {
    const search = useSearch({ from: "/app" });
    const library = useLibrary();

    return useMutation<null, Error, UpdateFavoritesArgs>({
        mutationKey: ["update-favorite", isFavorite],
        mutationFn: async (args) => {
            const query = { elementId: args.element.id };
            const path =
                "/favorites" + toLibraryPath(library) + toUserApiPath(search);

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
            await queryClient.cancelQueries({
                queryKey: ["library-user-data"]
            });
            queryClient.setQueryData(
                libraryUserDataQueryKey(library, search),
                getQueryUpdater((data: LibraryUserData) =>
                    updateFavorites(data, args)
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
            await queryClient.invalidateQueries({
                queryKey: ["library-user-data"]
            });
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
