import { Button, ButtonVariant, Colors, Icon } from "@blueprintjs/core";
import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { apiDelete, apiPost } from "../api/api";
import { FavoritesResult } from "../api/backend-types";
import { useOnshapeData } from "../api/onshape-data";
import { toUserApiPath } from "../api/path";
import { queryClient } from "../query-client";
import { router } from "../router";

interface FavoriteButtonProps {
    isFavorite: boolean;
    elementId: string;
}

export function FavoriteButton(props: FavoriteButtonProps): ReactNode {
    const { isFavorite, elementId } = props;
    const onshapeData = useOnshapeData();
    const mutation = useMutation({
        mutationKey: ["update-favorites", isFavorite],
        mutationFn: () => {
            const query = { elementId };
            if (isFavorite) {
                return apiDelete(
                    "/favorites" + toUserApiPath(onshapeData),
                    query
                );
            } else {
                return apiPost("/favorites" + toUserApiPath(onshapeData), {
                    query
                });
            }
        },
        onSuccess: () => {
            // Save a backend call by just updating the query directly
            queryClient.setQueryData(["favorites"], (data: FavoritesResult) => {
                const favorites = { ...data };
                if (isFavorite) {
                    delete favorites[elementId];
                } else {
                    favorites[elementId] = {};
                }
                return favorites;
            });
            router.invalidate();
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

    return (
        <Button
            icon={favoriteIcon}
            onClick={(event) => {
                event.stopPropagation();
                mutation.mutate();
            }}
            title={isFavorite ? "Remove favorite" : "Favorite"}
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
