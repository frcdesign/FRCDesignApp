import { skipToken, useQuery } from "@tanstack/react-query";
import { loadImage } from "../../../lib/api-client";
import { isInvalidConfiguration, loadRenderedImage } from "../render-wait";
import {
    renderQueryKey,
    storedThumbnailQueryKey
} from "../../../lib/query-keys";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    RenderSource,
    ThumbnailSize
} from "@backend/features/thumbnails/contract";
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
import { SectionNotice } from "../../../components/app-zero-state";
import { RENDER_BACKGROUND } from "../../../lib/style-constants";
import { useTargetElementType } from "../../insert/insert-hooks";
import { useIsFetchingConfiguration } from "../../insert/queries";
import { useAccessData } from "../../auth/access-level";
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
interface ThumbnailTarget {
    elementId: string;
    microversionId: string;
    /** Empty means the element default. */
    configurationKey: ConfigurationKey;
    /**
     * Set where a miss should start a render: surfaces the user picked the
     * configuration on. A search would otherwise start one per row.
     */
    renderSource?: RenderSource;
    /** Only needed to render: what the render resolves the element from. */
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

    // Asked for by key whether or not this row may start one: the route serves
    // what is already stored either way, so a row that cannot start one still shows
    // a configuration something else rendered. It costs that row a 404 when
    // nothing has, and it falls back to the element's own.
    const configuredTarget =
        target && target.configurationKey !== DEFAULT_CONFIGURATION_KEY
            ? target
            : undefined;

    const urlFor = (size: ThumbnailSize, stored?: string) =>
        configuredTarget ? thumbnailUrl({ ...configuredTarget, size }) : stored;

    // Only while a configuration is rendering: without a target the stored url
    // is what `urlFor` already returns, and falling back to it means nothing.
    const fallbackFor = (stored?: string) =>
        configuredTarget ? stored : undefined;

    // Only a row that started the render has one coming; anything else takes the
    // miss for the answer rather than waiting on a render nobody started.
    const isRendering = configuredTarget?.renderSource !== undefined;

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
    /**
     * The element's own thumbnail, shown until `url` renders — a render takes
     * minutes, and the unconfigured part is closer to the row than a spinner.
     * Loaded through a query of its own so a url whose bytes are gone shows the
     * same placeholder as anything else, rather than a broken image.
     */
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
        // Narrowed here rather than guarded inside: `enabled` is what keeps it
        // from running, and the query function should not restate that.
        queryFn: url
            ? ({ signal }) =>
                  isRendering
                      ? loadRenderedImage(url, signal)
                      : loadImage(url, signal)
            : skipToken,
        // A render waits itself out; asking again after it gives up would
        // only start the wait over.
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

    // The configuration's own render once it lands, and nothing after that:
    // the fallback stands in for it, it does not replace it.
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
        // No margin: the modal body it sits in supplies the inset, and the
        // padding stays tight so the preview is not lost inside its frame.
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

/** Sized to the preview's footprint rather than to a row's. */
const PREVIEW_SPINNER_SIZE = 36;

/**
 * Waits out a configuration's render. The first ask starts it, and asking
 * again while it runs starts nothing more, so a wait can ask as often as it
 * needs to.
 */
function usePreviewThumbnail(props: PreviewImageProps, enabled: boolean) {
    const { path, insertableId, microversionId, configurationKey } = props;
    const url = thumbnailUrl({
        elementId: path.elementId,
        microversionId,
        size: PREVIEW_SIZE,
        configurationKey,
        renderSource: RenderSource.INSERT_MENU,
        insertableId
    });

    return useQuery({
        queryKey: renderQueryKey(url),
        queryFn: ({ signal }) => loadRenderedImage(url, signal),
        // The previous configuration's render, so the box does not blank out
        // while this one is still being waited on.
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

    // Not known yet: the stored thumbnail would be swapped for the live preview
    // a moment later.
    if (isPending) {
        return spinner;
    }

    // Not signed in: no live Onshape preview, so show the stored thumbnail
    // (Thumbnail falls back to a placeholder when there's none).
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
        // Onshape had no insertable for the selection, which is as far as a
        // render gets: the part itself is what did not come out, so say that
        // rather than blaming the thumbnail.
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
                    // Standalone has no insert button to fall back on, and
                    // null suppresses the generic "contact the developers".
                    description={
                        isConnected ? `You can still ${action} the part.` : null
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
