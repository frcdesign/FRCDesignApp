import { useIsFetching, useQuery } from "@tanstack/react-query";
import { apiGet, apiGetImage, apiGetRawImage } from "../api-utils/api";
import { ThumbnailUrls, ThumbnailSize, ElementType } from "../../shared/types";
import { ElementPath, toElementApiPath } from "../../shared/onshape-path";
import { Box, Card, Center, HoverCard, Loader } from "@mantine/core";
import { IconHelp } from "@tabler/icons-react";

import { ComponentPropsWithRef, ReactNode } from "react";
import { ParameterValues } from "../../shared/configuration-models";
import { encodeConfigurationForQuery } from "../../shared/configuration-utils";
import { thumbnailUrl } from "../../shared/thumbnails";
import { getConfigurationMatchKey } from "../queries";
import { SectionError } from "../app-common/app-zero-state";
import { useTargetElementType } from "./insert-hooks";
import { useIsSignedIn } from "../api-utils/access-level";
import { useIsConnectedToOnshape } from "../api-utils/onshape-params";

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

/**
 * Where to read a configuration's thumbnails from. Rows only know a
 * configuration, not whether it has been rendered yet — the route falls back to
 * the element's default thumbnail until it has.
 */
export interface ThumbnailTarget {
    elementId: string;
    microversionId: string;
    /** The encoded canonical configuration; empty means the element default. */
    configuration: string;
    /**
     * Whether a miss should start rendering this configuration. Surfaces where
     * the user chose the configuration warm it; search results don't, since one
     * cold search would otherwise kick off a render per row.
     */
    warm: boolean;
}

interface CardThumbnailProps {
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
    /** Set to show a specific configuration rather than the element default. */
    target?: ThumbnailTarget;
}

/**
 * Thumbnail component used in lists, with a larger one on hover. Both sizes come
 * from the same configuration, so the two never disagree.
 */
export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { smallThumbnailUrl, largeThumbnailUrl, target } = props;

    const urlFor = (size: ThumbnailSize, stored?: string) =>
        target?.configuration ? thumbnailUrl({ ...target, size }) : stored;

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
                    url={urlFor(ThumbnailSize.SMALL, smallThumbnailUrl)}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.SMALL, 0.8)}
                    spinnerSize={25}
                />
            </HoverCard.Target>
            <HoverCard.Dropdown p="xs">
                <Thumbnail
                    url={urlFor(ThumbnailSize.LARGE, largeThumbnailUrl)}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.LARGE, 0.6)}
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
    /** Stored thumbnail, shown instead of the live preview when not signed in. */
    thumbnailUrls?: ThumbnailUrls;
    /** With the canonical configuration, lets the fetch also warm the R2 cache. */
    canonicalConfiguration?: string;
}

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const {
        path,
        microversionId,
        configuration,
        thumbnailUrls,
        canonicalConfiguration
    } = props;
    // A stored size, so the bytes this fetch returns are worth caching.
    const size = ThumbnailSize.LARGE;
    const isSignedIn = useIsSignedIn();
    const isConnected = useIsConnectedToOnshape();
    const isFetchingConfiguration =
        useIsFetching({ queryKey: getConfigurationMatchKey() }) > 0;
    const targetElementType = useTargetElementType();

    // Thumbnail id generation with queries is really unreliable
    // The standard Onshape API for it appears to be broken/bugged
    // So we use an undocumented alternate workflow where insertables returns an id
    // However, the id can take a while to update, so we have to poll the endpoint while waiting for it to load
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
        enabled: !isFetchingConfiguration && isSignedIn
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
                    thumbnailId,
                    // Let the worker store what it proxies, so this render is
                    // cached for the rows that show the same configuration.
                    ...(canonicalConfiguration
                        ? {
                              elementId: path.elementId,
                              v: microversionId,
                              c: canonicalConfiguration
                          }
                        : {})
                },
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
        enabled:
            !isFetchingConfiguration && thumbnailId !== undefined && isSignedIn
    });

    const heightAndWidth = getHeightAndWidth(size, 0.7);

    // Not signed in: no live Onshape preview, so show the stored thumbnail
    // (Thumbnail falls back to a placeholder when there's none).
    if (!isSignedIn) {
        return (
            <Thumbnail
                url={thumbnailUrls?.large}
                heightAndWidth={heightAndWidth}
                spinnerSize={36}
            />
        );
    }

    if (thumbnailIdQuery.isError || thumbnailQuery.isError) {
        const action =
            targetElementType === ElementType.ASSEMBLY ? "insert" : "derive";
        return (
            <Center w={heightAndWidth.width} h={heightAndWidth.height}>
                <SectionError
                    title="The thumbnail timed out."
                    // Standalone has no insert button to fall back on, and
                    // null suppresses the generic "contact the developers".
                    description={
                        isConnected ? `You can still ${action} the part.` : null
                    }
                />
            </Center>
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
