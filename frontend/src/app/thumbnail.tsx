import { useQuery } from "@tanstack/react-query";
import { apiGet, apiGetImage } from "../api/api";
import {
    getHeightAndWidth,
    encodeConfigurationForQuery,
    ThumbnailSize,
    Configuration
} from "../api/backend-types";
import { ElementPath, toElementApiPath } from "../api/path";
import { Card, Intent, Popover, Spinner, SpinnerSize } from "@blueprintjs/core";

import { ReactNode } from "react";

interface CardThumbnailProps {
    path: ElementPath;
}

export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { path } = props;

    return (
        <Popover
            content={
                <Card>
                    <Thumbnail
                        path={path}
                        spinnerSize={SpinnerSize.LARGE}
                        size={ThumbnailSize.STANDARD}
                        scale={0.6}
                    />
                </Card>
            }
            interactionKind="hover"
        >
            <div style={{ marginRight: "5px" }}>
                <Thumbnail
                    path={path}
                    spinnerSize={25}
                    size={ThumbnailSize.TINY}
                    scale={0.8}
                />
            </div>
        </Popover>
    );
}

interface ThumbnailProps {
    path: ElementPath;
    /**
     * The size (quality) of the given thumbnail.
     */
    size: ThumbnailSize;
    spinnerSize: SpinnerSize | number;
    /**
     * A scale multiplier applied to the image.
     */
    scale: number;
}

/**
 * A generic thumbnail component.
 */
function Thumbnail(props: ThumbnailProps): ReactNode {
    const { path, size, spinnerSize, scale } = props;

    const apiPath = toElementApiPath(path);
    const imageQuery = useQuery({
        queryKey: ["document-thumbnail", apiPath, size],
        queryFn: async ({ signal }) =>
            apiGetImage(
                "/thumbnail" + apiPath,
                {
                    size
                },
                signal
            )
    });

    const heightAndWidth = getHeightAndWidth(size);
    heightAndWidth.height *= scale;
    heightAndWidth.width *= scale;

    let content;
    if (imageQuery.isPending) {
        content = <Spinner intent={Intent.PRIMARY} size={spinnerSize} />;
    } else {
        content = <img src={imageQuery.data} {...heightAndWidth} />;
    }

    return (
        <div className="center" style={heightAndWidth}>
            {content}
        </div>
    );
}

interface PreviewImageProps {
    elementPath: ElementPath;
    configuration?: Configuration;
    isDialogPreview?: boolean;
}

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const { elementPath, configuration } = props;
    const size = ThumbnailSize.SMALL;

    // Thumbnail id generation with queries is really unreliable
    // The standard Onshape API for it appears to be broken/bugged
    // So we use an undocumented alternate workflow where insertables returns an id
    // However, the id can take a while to update, so we have to basically poll the endpoint while waiting for it to load
    const thumbnailIdQuery = useQuery({
        queryKey: [
            "thumbnail-id",
            toElementApiPath(elementPath),
            configuration
        ],
        queryFn: async ({ signal }) => {
            return apiGet(
                "/thumbnail-id" + toElementApiPath(elementPath),
                {
                    configuration: encodeConfigurationForQuery(configuration)
                },
                signal
            ).then((value) => value.thumbnailId);
        },
        // Don't retry since failures are almost certainly due to an invalid configuration
        retry: 0
    });

    const thumbnailQuery = useQuery({
        queryKey: [
            "thumbnail",
            toElementApiPath(elementPath),
            thumbnailIdQuery
        ],
        queryFn: async ({ signal }) => {
            const query: Record<string, string> = {
                size,
                thumbnailId: thumbnailIdQuery.data
            };
            return apiGetImage(
                "/thumbnail" + toElementApiPath(elementPath),
                query,
                signal
            );
        },
        placeholderData: (previousData) => previousData,
        // Cap max time between retries at 15 seconds with exponential backoff
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
        enabled: thumbnailIdQuery.data !== undefined
    });

    const heightAndWidth = getHeightAndWidth(size);
    if (thumbnailQuery.isPending && !thumbnailQuery.data) {
        return (
            <div className="center" style={heightAndWidth}>
                <Spinner intent={Intent.PRIMARY} size={SpinnerSize.STANDARD} />
            </div>
        );
    }

    const showSmallSpinner =
        thumbnailIdQuery.isRefetching || thumbnailQuery.isRefetching;

    return (
        <div style={{ position: "relative", ...heightAndWidth }}>
            {showSmallSpinner && (
                <Spinner
                    size={SpinnerSize.SMALL}
                    intent={Intent.PRIMARY}
                    style={{
                        position: "absolute",
                        bottom: "-5px",
                        right: "-25px"
                    }}
                />
            )}
            <img src={thumbnailQuery.data} {...heightAndWidth} />
        </div>
    );
}
