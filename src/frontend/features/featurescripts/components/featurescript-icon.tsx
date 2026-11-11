import { PuzzlePieceIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";

interface FeatureScriptIconProps {
    /** The feature's own; the generic puzzle piece without one. */
    iconUrl?: string;
    size: number;
}

/** Always an `<img>`, so nothing in an SVG runs. */
export function FeatureScriptIcon(props: FeatureScriptIconProps): ReactNode {
    const { iconUrl, size } = props;
    if (!iconUrl) {
        return <PuzzlePieceIcon size={size} style={{ flexShrink: 0 }} />;
    }
    return (
        <img
            src={iconUrl}
            width={size}
            height={size}
            alt=""
            style={{ flexShrink: 0 }}
        />
    );
}
