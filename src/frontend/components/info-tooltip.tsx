import { Tooltip } from "@mantine/core";
import { InfoIcon } from "@phosphor-icons/react";
import { type CSSProperties, type ReactNode } from "react";
import { IconSize, PrimaryColor } from "../lib/style-constants";
import { AppIcon } from "./app-icon";

interface InfoTooltipProps {
    /** What the bubble says; the icon is only its handle. */
    label: ReactNode;
    /** The color of what it sits in, where that has one. @default PrimaryColor.FILLED */
    color?: string;
    className?: string;
    /** For the odd icon that has to be nudged onto the line it sits in. */
    style?: CSSProperties;
}

/** In the page's own color, so it reads as something offered rather than a warning. */
export function InfoTooltip(props: InfoTooltipProps): ReactNode {
    const { label, color = PrimaryColor.FILLED, className, style } = props;

    return (
        <Tooltip label={label}>
            <AppIcon
                icon={InfoIcon}
                size={IconSize.SMALL}
                color={color}
                className={className}
                style={style}
            />
        </Tooltip>
    );
}
