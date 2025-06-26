import { useQuery } from "@tanstack/react-query";
import { apiGet, apiGetImage } from "../api/api";
import {
    getHeightAndWidth,
    encodeConfigurationForQuery,
    ThumbnailSize
} from "../api/backend-types";
import {
    ElementPath,
    InstancePath,
    isElementPath,
    toElementApiPath,
    toInstanceApiPath
} from "../api/path";
import { Intent, Spinner, SpinnerSize } from "@blueprintjs/core";
import { ReactNode } from "react";

export interface ThumbnailProps {
    path: InstancePath | ElementPath;
}

export function Thumbnail(props: ThumbnailProps): ReactNode {
    const { path } = props;
    const size = ThumbnailSize.TINY;

    const apiPath = isElementPath(path)
        ? toElementApiPath(path)
        : toInstanceApiPath(path);

    const imageQuery = useQuery({
        queryKey: ["document-thumbnail", apiPath],
        queryFn: () =>
            apiGetImage("/thumbnail" + apiPath, {
                size
            })
    });

    let content;
    if (imageQuery.isPending) {
        content = <Spinner intent={Intent.PRIMARY} size={25} />;
    } else {
        content = <img src={imageQuery.data} />;
    }

    const heightAndWidth = getHeightAndWidth(size);
    return (
        <div className="center" style={heightAndWidth}>
            {content}
        </div>
    );
    return;
}

export interface PreviewThumbnailProps {
    elementPath: ElementPath;
    configuration?: Record<string, string>;
    isDialogPreview?: boolean;
}

export function PreviewThumbnail(props: PreviewThumbnailProps): ReactNode {
    const { elementPath, configuration } = props;
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
        queryFn: () => {
            return apiGet("/thumbnail-id" + toElementApiPath(elementPath), {
                configuration: encodeConfigurationForQuery(configuration)
            }).then((value) => value.thumbnailId);
        }
    });

    const thumbnailQuery = useQuery({
        queryKey: ["thumbnail", toElementApiPath(elementPath), configuration],
        queryFn: () => {
            const query: Record<string, string> = {
                size,
                thumbnailId: thumbnailIdQuery.data
            };
            return apiGetImage(
                "/thumbnail" + toElementApiPath(elementPath),
                query
            );
        },
        retry: 10,
        enabled: thumbnailIdQuery.data !== undefined
    });

    const heightAndWidth = getHeightAndWidth(size);
    if (thumbnailQuery.isPending) {
        return (
            <div className="center" style={heightAndWidth}>
                <Spinner intent={Intent.PRIMARY} size={SpinnerSize.STANDARD} />
            </div>
        );
    }
    return <img src={thumbnailQuery.data} {...heightAndWidth} />;
}
