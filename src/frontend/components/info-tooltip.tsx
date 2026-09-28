import { Tooltip } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { type CSSProperties, type ReactNode } from "react";
import { IconSize, PrimaryColor } from "../lib/style-constants";
import { AppIcon } from "./app-icon";

interface InfoTooltipProps {
    /** What the bubble says; the icon is only its handle. */
    label: ReactNode;
    /** @default IconSize.SMALL */
    size?: IconSize;
    className?: string;
    /** For the odd icon that has to be nudged onto the line it sits in. */
    style?: CSSProperties;
}

/**
 * A line of explanation beside something, behind a bubble: it earns its room
 * the first few times and never again. In the page's own color, so it reads as
 * something offered rather than as a warning.
 */
export function InfoTooltip(props: InfoTooltipProps): ReactNode {
    const { label, size = IconSize.SMALL, className, style } = props;

    return (
        <Tooltip label={label}>
            <AppIcon
                icon={InfoIcon}
                size={size}
                color={PrimaryColor.FILLED}
                className={className}
                style={style}
            />
        </Tooltip>
    );
}
