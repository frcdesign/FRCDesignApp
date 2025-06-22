import { useQuery } from "@tanstack/react-query";
import { apiGetImage } from "../api/api";
import { getHeightAndWidth, ThumbnailSize } from "../api/backend-types";
import {
    ElementPath,
    makeConfigurationString,
    InstancePath,
    toElementApiPath,
    toInstanceApiPath
} from "../api/path";
import { Intent, Spinner, SpinnerSize } from "@blueprintjs/core";
import { ReactNode } from "react";

export interface DocumentThumbnailProps {
    instancePath: InstancePath;
}

export function DocumentThumbnail(props: DocumentThumbnailProps): ReactNode {
    const { instancePath } = props;
    const size = ThumbnailSize.TINY;

    const imageQuery = useQuery({
        queryKey: ["document-thumbnail", toInstanceApiPath(instancePath)],
        queryFn: () =>
            apiGetImage("/thumbnail" + toInstanceApiPath(instancePath), {
                size
            })
    });

    const heightAndWidth = getHeightAndWidth(size);
    if (imageQuery.isPending) {
        return (
            <div className="center" style={heightAndWidth}>
                <Spinner intent={Intent.PRIMARY} size={25} />
            </div>
        );
    }
    return <img src={imageQuery.data} {...heightAndWidth} />;
}

export interface ElementThumbnailProps {
    elementPath: ElementPath;
    configuration?: Record<string, string>;
    isDialogPreview?: boolean;
}

export function ElementThumbnail(props: ElementThumbnailProps): ReactNode {
    const { elementPath, configuration } = props;
    const isDialogPreview = props.isDialogPreview ?? false;
    const size = isDialogPreview ? ThumbnailSize.SMALL : ThumbnailSize.TINY;

    const imageQuery = useQuery({
        queryKey: [
            "document-thumbnail",
            toElementApiPath(elementPath),
            configuration,
            size
        ],
        queryFn: () =>
            apiGetImage("/thumbnail" + toElementApiPath(elementPath), {
                size,
                configuration: makeConfigurationString(configuration)
            })
    });

    const heightAndWidth = getHeightAndWidth(size);
    if (imageQuery.isPending) {
        return (
            <div className="center" style={heightAndWidth}>
                <Spinner
                    intent={Intent.PRIMARY}
                    size={isDialogPreview ? SpinnerSize.STANDARD : 25}
                />
            </div>
        );
    }
    return <img src={imageQuery.data} {...heightAndWidth} />;
}
