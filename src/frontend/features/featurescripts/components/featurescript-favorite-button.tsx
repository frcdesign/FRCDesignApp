import { ActionIcon } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import {
    FavoriteIcon,
    UnfavoriteIcon
} from "../../favorites/components/favorite-button";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import {
    useIsFeatureScriptFavorite,
    useToggleFavoriteMutation
} from "../queries";

interface FeatureScriptFavoriteButtonProps {
    feature: FeatureScriptOut;
    /** @default false */
    large?: boolean;
}

/** The heart a library's parts have: filled when favorited, broken on hover to unfavorite. */
export function FeatureScriptFavoriteButton(
    props: FeatureScriptFavoriteButtonProps
): ReactNode {
    const { feature, large = false } = props;
    const isFavorite = useIsFeatureScriptFavorite(feature.id);
    const toggle = useToggleFavoriteMutation(feature);
    const [isHovered, setIsHovered] = useState(false);

    const size = large ? IconSize.CONTROL : IconSize.SMALL;
    const icon =
        isHovered && isFavorite ? (
            <UnfavoriteIcon size={size} />
        ) : (
            <FavoriteIcon full={isFavorite} size={size} />
        );

    return (
        <ActionIcon
            size={large ? "input-sm" : undefined}
            title={
                isFavorite
                    ? m.featureScriptsUnfavorite()
                    : m.featureScriptsFavorite()
            }
            onClick={(event) => {
                // Inside a row, whose click opens the details.
                event.stopPropagation();
                toggle.mutate(!isFavorite);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {icon}
        </ActionIcon>
    );
}
