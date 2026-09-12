import { skipToken, useQuery } from "@tanstack/react-query";
import { loadImage } from "../../../lib/api-client";
import { ElementType } from "@backend/lib/onshape/element-type";
import {
    RenderSource,
    ThumbnailSize
} from "@backend/features/thumbnails/contract";
import { ElementPath } from "@backend/lib/onshape/path";
import { Box, Card, Center, HoverCard, Loader } from "@mantine/core";
import { QuestionIcon } from "@phosphor-icons/react";

import { ComponentPropsWithRef, PropsWithChildren, ReactNode } from "react";
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
     * Set where a miss should queue a render: surfaces the user picked the
     * configuration on. A search would otherwise queue a render per row, and
     * Onshape does one at a time.
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

    // Only a row that queues the render asks for one. Nothing else renders a
    // configuration, so a row that does not would be asking for a picture that
    // is never going to exist; the element's own is the honest thing to show.
    const renderTarget =
        target &&
        target.configurationKey !== DEFAULT_CONFIGURATION_KEY &&
        target.renderSource
            ? target
            : undefined;

    const urlFor = (size: ThumbnailSize, stored?: string) =>
        renderTarget ? thumbnailUrl({ ...renderTarget, size }) : stored;

    // Only while a configuration is rendering: without a target the stored url
    // is what `urlFor` already returns, and falling back to it means nothing.
    const fallbackFor = (stored?: string) =>
        renderTarget ? stored : undefined;

    // A url this row is having rendered answers 404 until the render lands.
    const isRendering = renderTarget !== undefined;

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
                    fallbackUrl={fallbackFor(smallThumbnailUrl)}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.SMALL, 0.8)}
                    spinnerSize={25}
                    isRendering={isRendering}
                />
            </HoverCard.Target>
            <HoverCard.Dropdown p="xs">
                <Thumbnail
                    url={urlFor(ThumbnailSize.LARGE, largeThumbnailUrl)}
                    fallbackUrl={fallbackFor(largeThumbnailUrl)}
                    heightAndWidth={getHeightAndWidth(ThumbnailSize.LARGE, 0.6)}
                    spinnerSize={48}
                    isRendering={isRendering}
                />
            </HoverCard.Dropdown>
        </HoverCard>
    );
}

/**
 * How a row waits out a render it asked for. A poll is a worker reading R2, not
 * an Onshape call — the renderer owns that cadence — so what this trades off is
 * how late a landed thumbnail shows up against how many requests a list of rows
 * makes between them.
 *
 * The horizon has to outlast the renderer, which gives a render five minutes of
 * the Onshape thread and retries a failed one three times: a row that stopped
 * sooner would report a render that was still perfectly alive as missing.
 */
const ROW_POLL_ATTEMPTS = 50;
const ROW_POLL_CAP_MS = 15_000;

const rowPollDelay = (attemptIndex: number) =>
    Math.min(2000 * 2 ** attemptIndex, ROW_POLL_CAP_MS);

/** Nothing is rendering it, so a miss is worth one more try and no more. */
const STORED_RETRIES = 1;

// Extend with div props to support being used as a HoverCard Target
interface ThumbnailProps extends ComponentPropsWithRef<"div"> {
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
    /** Whether a miss is a render still running, and so worth polling out. */
    isRendering?: boolean;
}

function Thumbnail(props: ThumbnailProps): ReactNode {
    const {
        url,
        fallbackUrl,
        heightAndWidth,
        spinnerSize,
        isRendering,
        ...centerProps
    } = props;

    const imageQuery = useQuery({
        queryKey: ["storage-thumbnail", url],
        // Narrowed here rather than guarded inside: `enabled` is what keeps it
        // from running, and the query function should not restate that.
        queryFn: url ? ({ signal }) => loadImage(url, signal) : skipToken,
        retry: isRendering ? ROW_POLL_ATTEMPTS : STORED_RETRIES,
        retryDelay: isRendering ? rowPollDelay : undefined
    });
    const fallbackQuery = useQuery({
        queryKey: ["storage-thumbnail", fallbackUrl],
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
        // No margin: the modal body it sits in supplies the inset, and the
        // padding stays tight so the preview is not lost inside its frame.
        <Card withBorder pos="relative" p="xs" bg={RENDER_BACKGROUND}>
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
 * How often to re-ask while the render is still running, and for how long.
 *
 * Tight at first because this is the last wait between a stored render and the
 * person watching the spinner, and a poll is a worker reading R2 rather than
 * anything asked of Onshape. It eases off after a minute, which is where
 * renders normally land, and then keeps going long enough to outlast the
 * renderer — five minutes of the Onshape thread, plus its retries. Stopping
 * before that reports a live render as a failure, which is what a spinner that
 * turns into an error while the thumbnail is still coming looks like.
 */
const PREVIEW_FAST_POLLS = 30;
const PREVIEW_FAST_MS = 2_000;
const PREVIEW_STEADY_MS = 5_000;
const PREVIEW_POLL_ATTEMPTS = 160;

const previewPollDelay = (attemptIndex: number) =>
    attemptIndex < PREVIEW_FAST_POLLS ? PREVIEW_FAST_MS : PREVIEW_STEADY_MS;

/**
 * Polls for the render the renderer produces. Until it lands the route answers
 * 404, so a miss is a rejected query and the retry is the poll; queueing is
 * idempotent, so every poll can carry it without disturbing what is running.
 */
function usePreviewThumbnail(props: PreviewImageProps, enabled: boolean) {
    const { path, insertableId, microversionId, configurationKey } = props;
    const url = thumbnailUrl({
        elementId: path.elementId,
        microversionId,
        size: PREVIEW_SIZE,
        configurationKey,
        // The one surface that may take the render thread off whatever else is
        // using it: somebody picked this configuration and is watching it load.
        renderSource: RenderSource.INSERT_MENU,
        insertableId
    });

    return useQuery({
        queryKey: ["thumbnail", url],
        queryFn: ({ signal }) => loadImage(url, signal),
        // The previous configuration's render, so the box does not blank out
        // while this one is still being waited on.
        placeholderData: (previousData) => previousData,
        retry: PREVIEW_POLL_ATTEMPTS,
        retryDelay: previewPollDelay,
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
