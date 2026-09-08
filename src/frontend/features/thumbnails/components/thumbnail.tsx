import { useQuery } from "@tanstack/react-query";
import {
    loadImage,
    loadImageResult,
    type LoadedImage
} from "../../../lib/api-client";
import { ElementType } from "@backend/lib/onshape/element-type";
import { ThumbnailSize } from "@backend/features/thumbnails/types";
import { ElementPath } from "@backend/lib/onshape/path";
import { Box, Card, Center, HoverCard, Loader } from "@mantine/core";
import { QuestionIcon } from "@phosphor-icons/react";

import {
    ComponentPropsWithRef,
    PropsWithChildren,
    ReactNode,
    useState
} from "react";
import { ELEMENT_DEFAULT_KEY } from "@backend/features/configurations/selection";
import { thumbnailUrl } from "@backend/features/thumbnails/keys";
import { SectionError } from "../../../components/app-zero-state";
import { useTargetElementType } from "../../insert/insert-hooks";
import { useIsFetchingConfiguration } from "../../insert/queries";
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
    configurationKey: string;
    /**
     * Whether a miss should start rendering: surfaces where the user picked the
     * configuration do, where a search would otherwise render a row at a time.
     */
    renderThumbnail: boolean;
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

    const urlFor = (size: ThumbnailSize, stored?: string) =>
        target && target.configurationKey !== ELEMENT_DEFAULT_KEY
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
        content = <QuestionIcon size={spinnerSize} />;
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
        // No margin: the modal body it sits in supplies the inset, and the
        // padding stays tight so the preview is not lost inside its frame.
        <Card withBorder pos="relative" p="xs">
            <Center>
                <PreviewImage {...props} />
            </Center>
        </Card>
    );
}

interface PreviewImageProps {
    path: ElementPath;
    /** The selection to preview; Onshape applies defaults for what it omits. */
    configurationKey: string;
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

/** How often to re-check while the worker is still standing in the default. */
const PREVIEW_POLL_MS = 4000;

/**
 * How many polls apart to ask for the render again. One request is meant to
 * start it; this only covers the run never having been queued at all.
 */
const RENDER_EVERY_POLLS = 15;

/**
 * The last render actually produced, kept across configuration changes: the
 * worker stands the element default in until a new one lands.
 */
function useLastRenderedUrl(image?: LoadedImage): string | undefined {
    const [lastRendered, setLastRendered] = useState<string>();
    if (image && !image.isFallback && image.url !== lastRendered) {
        setLastRendered(image.url);
    }
    return lastRendered;
}

/**
 * Polls for the configuration's render, which the worker produces in a
 * workflow: the first request starts one, and the element default stands in
 * until it lands.
 */
function usePreviewThumbnail(props: PreviewImageProps, enabled: boolean) {
    const { path, insertableId, microversionId, configurationKey } = props;
    // A url per poll: the browser caches images by url for the life of the
    // page, so reusing one leaves the stand-in up however often we refetch.
    const pollUrl = (attempt: number) =>
        thumbnailUrl({
            elementId: path.elementId,
            microversionId,
            size: PREVIEW_SIZE,
            configurationKey,
            renderThumbnail: attempt % RENDER_EVERY_POLLS === 0,
            insertableId,
            attempt
        });

    const queryKey = ["thumbnail", pollUrl(0)];
    const query = useQuery({
        queryKey,
        queryFn: ({ signal, client }) =>
            loadImageResult(
                // Counts the polls, so a new configuration starts over.
                pollUrl(client.getQueryState(queryKey)?.dataUpdateCount ?? 0),
                signal
            ),
        placeholderData: (previousData) => previousData,
        refetchInterval: (query) =>
            query.state.data?.isFallback ? PREVIEW_POLL_MS : false,
        retry: 2,
        enabled
    });
    return { query, lastRenderedUrl: useLastRenderedUrl(query.data) };
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

export function PreviewImage(props: PreviewImageProps): ReactNode {
    const { insertableId, microversionId, largeThumbnailUrl } = props;
    const isSignedIn = useIsSignedIn();
    const isConnected = useIsConnectedToOnshape();
    const isFetchingConfiguration = useIsFetchingConfiguration(
        insertableId,
        microversionId
    );
    const targetElementType = useTargetElementType();
    const { query, lastRenderedUrl } = usePreviewThumbnail(
        props,
        !isFetchingConfiguration && isSignedIn === true
    );

    const heightAndWidth = getHeightAndWidth(PREVIEW_SIZE, 0.7);
    const spinner = (
        <PreviewBox heightAndWidth={heightAndWidth}>
            <Loader size={PREVIEW_SPINNER_SIZE} />
        </PreviewBox>
    );

    // Not known yet: the stored thumbnail would be swapped for the live preview
    // a moment later.
    if (isSignedIn === undefined) {
        return spinner;
    }

    // Not signed in: no live Onshape preview, so show the stored thumbnail
    // (Thumbnail falls back to a placeholder when there's none).
    if (!isSignedIn) {
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
                <SectionError
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

    // A stand-in must not displace a render the user already has.
    const previewUrl =
        query.data.isFallback && lastRenderedUrl
            ? lastRenderedUrl
            : query.data.url;
    // Placeholder data is the previous configuration's render, so the spinner
    // has to cover it too: what is on screen is not what was asked for.
    const isWaiting = query.isPlaceholderData || query.data.isFallback;

    return (
        <>
            <Box
                pos="relative"
                w={heightAndWidth.width}
                h={heightAndWidth.height}
            >
                <img
                    src={previewUrl}
                    {...heightAndWidth}
                    style={FIT_INSIDE_BOX}
                />
            </Box>
            {isWaiting && (
                <Loader pos="absolute" bottom={15} right={15} size={18} />
            )}
        </>
    );
}
