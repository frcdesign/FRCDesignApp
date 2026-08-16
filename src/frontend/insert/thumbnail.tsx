import { useIsFetching, useQuery } from "@tanstack/react-query";
import { apiGet, apiGetImage, apiGetRawImage } from "../api-utils/api";
import { ThumbnailUrls, ThumbnailSize } from "../../shared/types";
import { ElementPath, toElementApiPath } from "../../shared/onshape-path";
import { Box, Card, Center, HoverCard, Loader } from "@mantine/core";
import { IconHelp } from "@tabler/icons-react";

import { ComponentPropsWithRef, ReactNode } from "react";
import { ParameterValues } from "../../shared/configuration-models";
import { encodeConfigurationForQuery } from "../../shared/configuration-utils";
import { getConfigurationMatchKey } from "../queries";
import { SectionError } from "../app-common/app-zero-state";

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

interface CardThumbnailProps {
    thumbnailUrls?: ThumbnailUrls;
}

/**
 * Thumbnail component used in lists.
 */
export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { thumbnailUrls } = props;

    return (
        <HoverCard
            withinPortal
            shadow="md"
            openDelay={150}
            closeDelay={50}
            position="right"
            withArrow
            arrowSize={20}
        >
            <HoverCard.Target>
                <Thumbnail
                    url={thumbnailUrls && thumbnailUrls[ThumbnailSize.TINY]}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.TINY, 0.8)}
                    spinnerSize={25}
                />
            </HoverCard.Target>
            <HoverCard.Dropdown p="xs">
                <Thumbnail
                    url={thumbnailUrls && thumbnailUrls[ThumbnailSize.STANDARD]}
                    heightAndWidth={getHeightAndWidth(
                        ThumbnailSize.STANDARD,
                        0.6
                    )}
                    spinnerSize={48}
                />
            </HoverCard.Dropdown>
        </HoverCard>
    );
}

// Extend with div props to support being used as a HoverCard Target
interface ThumbnailProps extends ComponentPropsWithRef<"div"> {
    url?: string;
    spinnerSize: number;
    heightAndWidth: HeightAndWidth;
}

/**
 * A generic thumbnail component.
 */
function Thumbnail(props: ThumbnailProps): ReactNode {
    const { url, heightAndWidth, spinnerSize, ...centerProps } = props;

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
        content = <Loader size={spinnerSize} />;
    } else {
        content = <img src={imageQuery.data} {...heightAndWidth} />;
    }

    return (
        <Center
            {...centerProps}
            w={heightAndWidth.width}
            h={heightAndWidth.height}
        >
            {content}
        </Center>
    );
}

export function PreviewImageCard(props: PreviewImageProps): ReactNode {
    return (
        <Card withBorder pos="relative" m="sm" mb={0}>
            <Center>
                <PreviewImage {...props} />
            </Center>
        </Card>
    );
}

interface PreviewImageProps {
    path: ElementPath;
    microversionId: string;
    configuration?: ParameterValues;
}

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const { path, microversionId, configuration } = props;
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
                query: { size, thumbnailId },
                cacheId: microversionId,
                signal
            });
        },
        placeholderData: (previousData) => previousData,
        // Cap max time between retries at 15 seconds with exponential backoff
        retryDelay: (attempt) => {
            // Try again after 3 seconds, 5 seconds, and then 15 seconds
            if (attempt === 1) {
                return 3000;
            } else if (attempt === 2) {
                return 5000;
            }
            return 15000;
        },
        retry: 5,
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
            <Center w={heightAndWidth.width} h={heightAndWidth.height}>
                <Loader size={36} />
            </Center>
        );
    }

    return (
        <>
            <Box
                pos="relative"
                w={heightAndWidth.width}
                h={heightAndWidth.height}
            >
                <img src={thumbnailQuery.data} {...heightAndWidth} />
            </Box>
            {(thumbnailQuery.isFetching || thumbnailIdQuery.isFetching) && (
                <Loader pos="absolute" bottom={15} right={15} size={18} />
            )}
        </>
    );
}
