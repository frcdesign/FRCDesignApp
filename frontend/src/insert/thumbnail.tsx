import { useQuery } from "@tanstack/react-query";
import {
    apiGet,
    apiGetImage,
    apiGetRawImage,
    useCacheOptions
} from "../api/api";
import {
    getHeightAndWidth,
    HeightAndWidth,
    ThumbnailSize,
    ThumbnailUrls
} from "../api/models";
import { ElementPath, toElementApiPath } from "../api/path";
import {
    Card,
    Icon,
    Intent,
    Popover,
    Spinner,
    SpinnerSize
} from "@blueprintjs/core";

import { ReactNode } from "react";
import {
    Configuration,
    encodeConfigurationForQuery
} from "../insert/configuration-models";
import { AppErrorState } from "../common/app-zero-state";

interface CardThumbnailProps {
    thumbnailUrls: ThumbnailUrls;
}

export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { thumbnailUrls } = props;

    return (
        <Popover
            content={
                <Card>
                    <Thumbnail
                        url={thumbnailUrls[ThumbnailSize.STANDARD]}
                        heightAndWidth={getHeightAndWidth(
                            ThumbnailSize.STANDARD,
                            0.6
                        )}
                        spinnerSize={SpinnerSize.LARGE}
                    />
                </Card>
            }
            interactionKind="hover"
        >
            <div style={{ marginRight: "5px" }}>
                <Thumbnail
                    url={thumbnailUrls[ThumbnailSize.TINY]}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.TINY, 0.8)}
                    spinnerSize={25}
                />
            </div>
        </Popover>
    );
}

interface ThumbnailProps {
    url: string;
    spinnerSize: SpinnerSize | number;
    heightAndWidth: HeightAndWidth;
}

/**
 * A generic thumbnail component.
 */
function Thumbnail(props: ThumbnailProps): ReactNode {
    const { url, heightAndWidth, spinnerSize } = props;

    const imageQuery = useQuery({
        queryKey: ["storage-thumbnail", url],
        queryFn: async ({ signal }) => apiGetRawImage(url, signal),
        retry: 1
    });

    let content;
    if (imageQuery.isPending) {
        content = <Spinner intent={Intent.PRIMARY} size={spinnerSize} />;
    } else if (imageQuery.isError) {
        content = <Icon icon="help" size={spinnerSize} />;
    } else {
        content = <img src={imageQuery.data} {...heightAndWidth} />;
    }

    return (
        <div className="center" style={heightAndWidth}>
            {content}
        </div>
    );
}

export function PreviewImageCard(props: PreviewImageProps): ReactNode {
    return (
        <Card className="center preview-image-card">
            <PreviewImage
                elementPath={props.elementPath}
                configuration={props.configuration}
                pauseLoading={props.pauseLoading}
            />
        </Card>
    );
}

interface PreviewImageProps {
    elementPath: ElementPath;
    configuration?: Configuration;
    pauseLoading?: boolean;
}

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const { elementPath, configuration, pauseLoading } = props;
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
            return apiGet("/thumbnail-id" + toElementApiPath(elementPath), {
                query: {
                    configuration: encodeConfigurationForQuery(configuration)
                },
                signal
            }).then((value) => value.thumbnailId);
        },
        // Don't retry since failures are almost certainly due to an invalid configuration
        retry: 0,
        enabled: !pauseLoading
    });

    const thumbnailId = thumbnailIdQuery.data;
    console.log(thumbnailId);

    const cacheOptions = useCacheOptions();
    const thumbnailQuery = useQuery({
        queryKey: ["thumbnail", toElementApiPath(elementPath), thumbnailId],
        queryFn: async ({ signal }) => {
            return apiGetImage("/thumbnail" + toElementApiPath(elementPath), {
                query: {
                    size,
                    thumbnailId
                },
                signal,
                cacheOptions
            });
        },
        placeholderData: (previousData) => previousData,
        // Cap max time between retries at 15 seconds with exponential backoff
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
        retry: Infinity, // Allow indefinite retrying
        enabled: thumbnailId && !pauseLoading,
        staleTime: Infinity
    });

    const heightAndWidth = getHeightAndWidth(size, 0.7);

    if (thumbnailIdQuery.isError) {
        return (
            <div style={heightAndWidth}>
                <AppErrorState
                    title="Failed to load configuration"
                    inline={false}
                />
            </div>
        );
    }

    if (thumbnailQuery.isPending && !thumbnailQuery.data) {
        return (
            <div className="center" style={heightAndWidth}>
                <Spinner intent={Intent.PRIMARY} size={SpinnerSize.STANDARD} />
            </div>
        );
    }

    const showSmallSpinner =
        thumbnailIdQuery.isFetching || thumbnailQuery.isFetching;

    return (
        <>
            <div style={{ position: "relative", ...heightAndWidth }}>
                <img src={thumbnailQuery.data} {...heightAndWidth} />
            </div>
            {showSmallSpinner && (
                <Spinner
                    size={SpinnerSize.SMALL}
                    intent={Intent.PRIMARY}
                    style={{
                        position: "absolute",
                        bottom: "15px",
                        right: "15px"
                    }}
                />
            )}
        </>
    );
}
