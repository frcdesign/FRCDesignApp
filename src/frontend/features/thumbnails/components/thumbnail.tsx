import { skipToken, useQuery } from "@tanstack/react-query";
import { loadImage } from "../../../lib/api-client";
import { isInvalidConfiguration, loadRenderedImage } from "../render-wait";
import {
    renderQueryKey,
    storedThumbnailQueryKey
} from "../../../lib/query-keys";
import { ElementType } from "@backend/lib/onshape/element-type";
import { ThumbnailSize } from "@backend/features/thumbnails/contract";
import { ElementPath } from "@backend/lib/onshape/path";
import { Box, Card, Center, Loader } from "@mantine/core";
import { AppHoverCard } from "../../../components/app-hover-card";
import { QuestionIcon } from "@phosphor-icons/react";

import { PropsWithChildren, ReactNode } from "react";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY
} from "@backend/features/configurations/contract";
import { thumbnailUrl } from "@backend/features/thumbnails/keys";
import { SectionNotice } from "../../../components/app-notice";
import { RENDER_BACKGROUND } from "../../../lib/style-constants";
import { useTargetElementType } from "../../insert/insert-hooks";
import { useIsFetchingConfiguration } from "../../insert/queries";
import { useAccessData } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";

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
interface ThumbnailTarget {
    elementId: string;
    microversionId: string;
    /** Empty means the element default. */
    configurationKey: ConfigurationKey;
    /** Starts a render on a miss. Only set where the user picked the configuration, so a search doesn't start one per row. */
    insertableId?: string;
}

interface CardThumbnailProps {
    smallThumbnailUrl?: string;
    largeThumbnailUrl?: string;
    /** Omit for the element's default. */
    target?: ThumbnailTarget;
}

/** Both sizes come from one configuration, so a row and its hover never disagree. */
export function CardThumbnail(props: CardThumbnailProps): ReactNode {
    const { smallThumbnailUrl, largeThumbnailUrl, target } = props;

    // Always asked for by key, so a row that can't start a render still shows one
    // that something else started.
    const configuredTarget =
        target && target.configurationKey !== DEFAULT_CONFIGURATION_KEY
            ? target
            : undefined;

    const urlFor = (size: ThumbnailSize, stored?: string) =>
        configuredTarget ? thumbnailUrl({ ...configuredTarget, size }) : stored;

    const fallbackFor = (stored?: string) =>
        configuredTarget ? stored : undefined;

    // Only a row that started the render waits for one.
    const isRendering = configuredTarget?.insertableId !== undefined;

    return (
        <AppHoverCard
            openDelay={150}
            closeDelay={50}
            position="right"
            arrowSize={20}
            padding="xs"
            target={
                <Thumbnail
                    url={urlFor(ThumbnailSize.SMALL, smallThumbnailUrl)}
                    fallbackUrl={fallbackFor(smallThumbnailUrl)}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.SMALL, 0.8)}
                    spinnerSize={25}
                    isRendering={isRendering}
                />
            }
        >
            <Thumbnail
                url={urlFor(ThumbnailSize.LARGE, largeThumbnailUrl)}
                fallbackUrl={fallbackFor(largeThumbnailUrl)}
                heightAndWidth={getHeightAndWidth(ThumbnailSize.LARGE, 0.6)}
                spinnerSize={48}
                isRendering={isRendering}
            />
        </AppHoverCard>
    );
}

/** Nothing is rendering it, so a miss is worth one more try and no more. */
const STORED_RETRIES = 1;

interface ThumbnailProps {
    url?: string;
    /** Shown until `url` renders, which can take minutes. */
    fallbackUrl?: string;
    spinnerSize: number;
    heightAndWidth: HeightAndWidth;
    /** Whether a miss is a render still running, and so worth waiting out. */
    isRendering?: boolean;
}

function Thumbnail(props: ThumbnailProps): ReactNode {
    const { url, fallbackUrl, heightAndWidth, spinnerSize, isRendering } =
        props;

    const imageQuery = useQuery({
        queryKey: storedThumbnailQueryKey(url),
        queryFn: url
            ? ({ signal }) =>
                  isRendering
                      ? loadRenderedImage(url, signal)
                      : loadImage(url, signal)
            : skipToken,
        // A render waits itself out; retrying would restart the wait.
        retry: isRendering ? false : STORED_RETRIES
    });
    const fallbackQuery = useQuery({
        queryKey: storedThumbnailQueryKey(fallbackUrl),
        queryFn: fallbackUrl
            ? ({ signal }) => loadImage(fallbackUrl, signal)
            : skipToken,
        retry: STORED_RETRIES,
        enabled: !imageQuery.isSuccess
    });

    const shownUrl = imageQuery.data ?? fallbackQuery.data;

    let content;
    if (shownUrl !== undefined) {
        content = (
            <img src={shownUrl} {...heightAndWidth} style={FIT_INSIDE_BOX} />
        );
    } else if (url === undefined || imageQuery.isError) {
        content = <QuestionIcon size={spinnerSize} />;
    } else {
        content = <Loader size={spinnerSize} />;
    }

    return (
        <Center w={heightAndWidth.width} h={heightAndWidth.height}>
            {content}
        </Center>
    );
}

export function PreviewImageCard(props: PreviewImageProps): ReactNode {
    return (
        <Card pos="relative" p="xs" radius="sm" bg={RENDER_BACKGROUND}>
            <Center>
                <PreviewImage {...props} />
            </Center>
        </Card>
    );
}

interface PreviewImageProps {
    path: ElementPath;
    /** The selection to preview; Onshape applies defaults for what it omits. */
    configurationKey: ConfigurationKey;
    /** Part of the thumbnail key, so an updated document renders again. */
    microversionId: string;
    /** What the render resolves the element from. */
    insertableId: string;
    /** Stored thumbnail, shown instead of the live preview when not signed in. */
    largeThumbnailUrl?: string;
}

/** A stored size, so the bytes a preview fetch returns are worth caching. */
const PREVIEW_SIZE = ThumbnailSize.LARGE;

const PREVIEW_SPINNER_SIZE = 36;

/** The first ask starts the render; later asks start nothing more. */
function usePreviewThumbnail(props: PreviewImageProps, enabled: boolean) {
    const { path, insertableId, microversionId, configurationKey } = props;
    const url = thumbnailUrl({
        elementId: path.elementId,
        microversionId,
        size: PREVIEW_SIZE,
        configurationKey,
        insertableId
    });

    return useQuery({
        queryKey: renderQueryKey(url),
        queryFn: ({ signal }) => loadRenderedImage(url, signal),
        // Keeps the previous render up while this one is waited on.
        placeholderData: (previousData) => previousData,
        retry: false,
        enabled
    });
}

interface PreviewBoxProps extends PropsWithChildren {
    heightAndWidth: HeightAndWidth;
}

/** Holds the preview's own footprint, whatever is being shown in it. */
function PreviewBox(props: PreviewBoxProps): ReactNode {
    const { heightAndWidth, children } = props;
    return (
        <Center w={heightAndWidth.width} h={heightAndWidth.height}>
            {children}
        </Center>
    );
}

function PreviewImage(props: PreviewImageProps): ReactNode {
    const { insertableId, microversionId, largeThumbnailUrl } = props;
    const { signedIn, isPending } = useAccessData();
    const isConnected = useIsConnectedToOnshape();
    const isFetchingConfiguration = useIsFetchingConfiguration(
        insertableId,
        microversionId
    );
    const targetElementType = useTargetElementType();
    const query = usePreviewThumbnail(
        props,
        !isFetchingConfiguration && signedIn
    );

    const heightAndWidth = getHeightAndWidth(PREVIEW_SIZE, 0.7);
    const spinner = (
        <PreviewBox heightAndWidth={heightAndWidth}>
            <Loader size={PREVIEW_SPINNER_SIZE} />
        </PreviewBox>
    );

    // Otherwise the stored thumbnail flashes before the live preview.
    if (isPending) {
        return spinner;
    }

    // Live previews need an Onshape session.
    if (!signedIn) {
        return (
            <Thumbnail
                url={largeThumbnailUrl}
                heightAndWidth={heightAndWidth}
                spinnerSize={PREVIEW_SPINNER_SIZE}
            />
        );
    }

    if (query.isError) {
        // The part itself failed to regenerate, not the thumbnail.
        if (isInvalidConfiguration(query.error)) {
            return (
                <PreviewBox heightAndWidth={heightAndWidth}>
                    <SectionNotice
                        title="Part failed to regenerate."
                        description="Your configuration may be invalid."
                    />
                </PreviewBox>
            );
        }

        const action =
            targetElementType === ElementType.ASSEMBLY ? "insert" : "derive";
        return (
            <PreviewBox heightAndWidth={heightAndWidth}>
                <SectionNotice
                    title="The thumbnail could not be loaded."
                    description={
                        isConnected
                            ? `You can still ${action} the part.`
                            : undefined
                    }
                />
            </PreviewBox>
        );
    }
    if (!query.data) {
        return spinner;
    }

    return (
        <>
            <Box
                pos="relative"
                w={heightAndWidth.width}
                h={heightAndWidth.height}
            >
                <img
                    src={query.data}
                    {...heightAndWidth}
                    style={FIT_INSIDE_BOX}
                />
            </Box>
            {/* What is on screen is the previous configuration's render, not
                the one that was asked for. */}
            {query.isPlaceholderData && (
                <Loader pos="absolute" bottom={15} right={15} size={18} />
            )}
        </>
    );
}
