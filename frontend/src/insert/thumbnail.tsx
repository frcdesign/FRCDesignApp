import { useIsFetching, useQuery } from "@tanstack/react-query";
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
import { getConfigurationMatchKey } from "../queries";
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
    url?: string;
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
        queryFn: async ({ signal }) => {
            if (url === undefined) {
                throw new Error("Tried to get thumbnail with no URL");
            }
            return apiGetRawImage(url, signal);
        },
        retry: 1,
        enabled: url !== undefined
    });

    let content;
    if (url === undefined || imageQuery.isError) {
        content = <Icon icon="help" size={spinnerSize} />;
    } else if (imageQuery.isPending) {
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

export function PreviewImageCard(props: PreviewImageProps): ReactNode {
    return (
        <Card className="center preview-image-card">
            <PreviewImage {...props} />
        </Card>
    );
}

interface PreviewImageProps {
    path: ElementPath;
    configuration?: Configuration;
}

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const { path, configuration } = props;
    const size = ThumbnailSize.SMALL;
    const isFetchingConfiguration =
        useIsFetching({ queryKey: getConfigurationMatchKey() }) > 0;

    // Thumbnail id generation with queries is really unreliable
    // The standard Onshape API for it appears to be broken/bugged
    // So we use an undocumented alternate workflow where insertables returns an id
    // However, the id can take a while to update, so we have to basically poll the endpoint while waiting for it to load
    const thumbnailIdQuery = useQuery({
        queryKey: ["thumbnail", "id", toElementApiPath(path), configuration],
        queryFn: async ({ signal }) => {
            return apiGet("/thumbnail-id" + toElementApiPath(path), {
                query: {
                    configuration: encodeConfigurationForQuery(configuration)
                },
                signal
            }).then((value) => value.thumbnailId as string);
        },
        // Don't retry since failures are almost certainly due to an invalid configuration
        retry: false,
        enabled: !isFetchingConfiguration
    });

    const thumbnailId = thumbnailIdQuery.data;

    const cacheOptions = useCacheOptions();
    const thumbnailQuery = useQuery({
        queryKey: ["thumbnail", thumbnailId],
        queryFn: async ({ signal }) => {
            if (!thumbnailId) {
                // Shouldn't happen due to enabled guard
                return;
            }
            return apiGetImage("/thumbnail", {
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
        retry: 15,
        enabled: !isFetchingConfiguration && thumbnailId !== undefined
    });

    const heightAndWidth = getHeightAndWidth(size, 0.7);

    if (thumbnailIdQuery.isError || thumbnailQuery.isError) {
        return (
            <AppErrorState
                title="Thumbnail generation timed out."
                description="You can still insert the part normally."
                inline={false}
            />
        );
    } else if (thumbnailQuery.isPending && !thumbnailQuery.data) {
        return (
            <div className="center" style={heightAndWidth}>
                <Spinner intent={Intent.PRIMARY} size={SpinnerSize.STANDARD} />
            </div>
        );
    }

    return (
        <>
            <div style={{ position: "relative", ...heightAndWidth }}>
                <img src={thumbnailQuery.data} {...heightAndWidth} />
            </div>
            {(thumbnailQuery.isFetching || thumbnailIdQuery.isFetching) && (
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
