import { useIsFetching, useQuery } from "@tanstack/react-query";
import { apiGet, apiGetImage, apiGetRawImage } from "../api-utils/api";
import { ThumbnailUrls, ThumbnailSize } from "../../shared/types";

interface HeightAndWidth {
    height: number;
    width: number;
}

function getHeightAndWidth(
    size: ThumbnailSize,
    multiplier = 1
): HeightAndWidth {
    const parts = size.split("x");
    return {
        width: parseInt(parts[0]) * multiplier,
        height: parseInt(parts[1]) * multiplier
    };
}
import { ElementPath, toElementApiPath } from "../../shared/path";
import { Card, HoverCard, Loader } from "@mantine/core";
import { IconHelp } from "@tabler/icons-react";

import { ReactNode } from "react";
import { Configuration } from "../../shared/configuration-models";
import { encodeConfigurationForQuery } from "../../shared/configuration-utils";
import { getConfigurationMatchKey } from "../queries";
import { SectionError } from "../common/app-zero-state";

interface CardThumbnailProps {
    thumbnailUrls: ThumbnailUrls;
}

export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { thumbnailUrls } = props;

    return (
        <HoverCard withinPortal shadow="md" openDelay={150} closeDelay={50}>
            <HoverCard.Target>
                <div style={{ marginRight: "5px", display: "flex" }}>
                    <Thumbnail
                        url={thumbnailUrls[ThumbnailSize.TINY]}
                        heightAndWidth={getHeightAndWidth(
                            ThumbnailSize.TINY,
                            0.8
                        )}
                        spinnerSize={25}
                    />
                </div>
            </HoverCard.Target>
            <HoverCard.Dropdown p="xs">
                <Thumbnail
                    url={thumbnailUrls[ThumbnailSize.STANDARD]}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.STANDARD, 0.6)}
                    spinnerSize={48}
                />
            </HoverCard.Dropdown>
        </HoverCard>
    );
}

interface ThumbnailProps {
    url?: string;
    spinnerSize: number;
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
        content = <IconHelp size={spinnerSize} />;
    } else if (imageQuery.isPending) {
        content = <Loader color="blue" size={spinnerSize} />;
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
                signal
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
            <SectionError
                title="Thumbnail generation timed out."
                description="You can still insert the part normally."
            />
        );
    } else if (thumbnailQuery.isPending && !thumbnailQuery.data) {
        return (
            <div className="center" style={heightAndWidth}>
                <Loader color="blue" size={36} />
            </div>
        );
    }

    return (
        <>
            <div style={{ position: "relative", ...heightAndWidth }}>
                <img src={thumbnailQuery.data} {...heightAndWidth} />
            </div>
            {(thumbnailQuery.isFetching || thumbnailIdQuery.isFetching) && (
                <Loader
                    color="blue"
                    size={18}
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
