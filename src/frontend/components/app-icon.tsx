import { Box } from "@mantine/core";
import type { Icon, IconWeight } from "@phosphor-icons/react";
import { ComponentPropsWithRef, ReactNode } from "react";
import { IconSize, StatusColor } from "../lib/style-constants";

export interface AppIconProps
    // Rendered through Box, which owns these two as style props.
    extends Omit<ComponentPropsWithRef<"svg">, "color" | "display"> {
    icon: Icon;
    /** @default IconSize.SMALL */
    size?: IconSize;
    /** A theme color; without one the icon takes the surrounding text's. */
    color?: StatusColor | string;
    /** @default "regular" */
    weight?: IconWeight;
    /** What a screen reader calls an icon that carries meaning on its own. */
    label?: string;
}

/**
 * A Phosphor icon in a theme color. Box resolves the name, and sizes through
 * `fz` because its own `style` would drop the icon's.
 */
export function AppIcon({
    icon,
    size = IconSize.SMALL,
    color,
    weight,
    label,
    ...others
}: AppIconProps): ReactNode {
    return (
        <Box
            component={icon}
            fz={size}
            c={color}
            weight={weight}
            aria-label={label}
            {...others}
        />
    );
}
