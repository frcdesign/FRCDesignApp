import { useIsFetching, useQuery } from "@tanstack/react-query";
import { loadImage, loadImageResult } from "../../../lib/api-client";
import { ElementType } from "@backend/lib/onshape/element-type";
import { ThumbnailSize } from "@backend/features/thumbnails/types";
import { ElementPath } from "@backend/lib/onshape/path";
import { Box, Card, Center, HoverCard, Loader } from "@mantine/core";
import { IconHelp } from "@tabler/icons-react";

import { ComponentPropsWithRef, ReactNode } from "react";
import { DEFAULT_CANONICAL_CONFIGURATION } from "@backend/features/configurations/canonical";
import { thumbnailUrl } from "@backend/features/thumbnails/keys";
import { configurationQueryMatchKey } from "../../../lib/query-keys";
import { SectionError } from "../../../components/app-zero-state";
import { useTargetElementType } from "../../insert/insert-hooks";
import { useIsSignedIn } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";

/** Letterbox rather than stretch, in case the render is not the size we asked for. */
const FIT_INSIDE_BOX = {
    objectFit: "contain",
    maxWidth: "100%",
    maxHeight: "100%"
} as const;

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

/** Rows know a configuration, not whether it is rendered; the route falls back. */
export interface ThumbnailTarget {
    elementId: string;
    microversionId: string;
    /** Empty means the element default. */
    canonicalConfiguration: string;
    /**
     * Surfaces where the user picked the configuration warm it; a cold search
     * would otherwise start a render per row.
     */
    warm: boolean;
    /** Only needed to warm: what the render resolves the element from. */
    insertableId?: string;
}

interface CardThumbnailProps {
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
    /** Set to show a specific configuration rather than the element default. */
    target?: ThumbnailTarget;
}

/** Both sizes come from one configuration, so a row and its hover never disagree. */
export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { smallThumbnailUrl, largeThumbnailUrl, target } = props;

    const urlFor = (size: ThumbnailSize, stored?: string) =>
        target &&
        target.canonicalConfiguration !== DEFAULT_CANONICAL_CONFIGURATION
            ? thumbnailUrl({ ...target, size })
            : stored;

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

function Thumbnail(props: ThumbnailProps): ReactNode {
    const { url, heightAndWidth, spinnerSize, ...centerProps } = props;

    const imageQuery = useQuery({
        queryKey: ["storage-thumbnail", url],
        queryFn: ({ signal }) => {
            if (url === undefined) {
                throw new Error("Tried to get thumbnail with no URL");
            }
            return loadImage(url, signal);
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
        content = (
            <img
                src={imageQuery.data}
                {...heightAndWidth}
                style={FIT_INSIDE_BOX}
            />
        );
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
    /** The selection to preview; Onshape applies defaults for what it omits. */
    canonicalConfiguration: string;
    /** Part of the thumbnail key, so an updated document renders again. */
    microversionId: string;
    /** What the render resolves the element from. */
    insertableId: string;
    /** Stored thumbnail, shown instead of the live preview when not signed in. */
    largeThumbnailUrl?: string;
}

/** How often to re-check while the worker is still standing in the default. */
const PREVIEW_POLL_MS = 4000;

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const {
        path,
        insertableId,
        microversionId,
        canonicalConfiguration,
        largeThumbnailUrl
    } = props;
    // A stored size, so the bytes this fetch returns are worth caching.
    const size = ThumbnailSize.LARGE;
    const isSignedIn = useIsSignedIn();
    const isConnected = useIsConnectedToOnshape();
    const isFetchingConfiguration =
        useIsFetching({ queryKey: configurationQueryMatchKey() }) > 0;
    const targetElementType = useTargetElementType();

    const url = thumbnailUrl({
        elementId: path.elementId,
        microversionId,
        size,
        canonicalConfiguration,
        warm: true,
        insertableId
    });

    // The worker renders configurations in a workflow, so the first request
    // starts one and stands in the element default until it lands.
    const thumbnailQuery = useQuery({
        queryKey: ["thumbnail", url],
        queryFn: ({ signal }) => loadImageResult(url, signal),
        placeholderData: (previousData) => previousData,
        refetchInterval: (query) =>
            query.state.data?.isFallback ? PREVIEW_POLL_MS : false,
        retry: 2,
        enabled: !isFetchingConfiguration && isSignedIn
    });

    const heightAndWidth = getHeightAndWidth(size, 0.7);

    // Not signed in: no live Onshape preview, so show the stored thumbnail
    // (Thumbnail falls back to a placeholder when there's none).
    if (!isSignedIn) {
        return (
            <Thumbnail
                url={largeThumbnailUrl}
                heightAndWidth={heightAndWidth}
                spinnerSize={36}
            />
        );
    }

    if (thumbnailQuery.isError) {
        const action =
            targetElementType === ElementType.ASSEMBLY ? "insert" : "derive";
        return (
            <Center w={heightAndWidth.width} h={heightAndWidth.height}>
                <SectionError
                    title="The thumbnail could not be loaded."
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
                <img
                    src={thumbnailQuery.data.url}
                    {...heightAndWidth}
                    style={FIT_INSIDE_BOX}
                />
            </Box>
            {thumbnailQuery.data.isFallback && (
                <Loader pos="absolute" bottom={15} right={15} size={18} />
            )}
        </>
    );
}
