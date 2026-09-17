import { Box } from "@mantine/core";
import type { Icon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { AppIcon } from "./app-icon";
import {
    CONTROL_ICON_COLOR,
    IconSize,
    NO_SHRINK,
    StatusColor
} from "../lib/style-constants";

export interface StatusIconProps {
    /** What the status is about: the target tab, a build, a connection. */
    icon: Icon;
    /** The state itself, badged on the corner — a tick or a warning. */
    status: Icon;
    color: StatusColor | string;
}

/** The size any other icon-only control in the bar is drawn at. */
const SUBJECT_SIZE = IconSize.CONTROL;

/** Big enough that a tick and a warning can be told apart at a glance. */
const BADGE_SIZE = 14;

/**
 * How far the badge hangs past the subject's corner. The rest of it overlaps,
 * and the subject has to stay recognizable under that.
 */
const BADGE_OVERHANG = 4;

/**
 * A subject icon with its state badged on its bottom-right corner, told by
 * shape as well as by color — a tick and a warning stay apart where green and
 * yellow do not.
 *
 * The box is the subject's own size, so the subject lines up with the plain
 * icons either side of it and the badge hangs outside it.
 */
export function StatusIcon(props: StatusIconProps): ReactNode {
    const { icon, status, color } = props;
    return (
        <Box
            pos="relative"
            w={SUBJECT_SIZE}
            h={SUBJECT_SIZE}
            // Zero line height, or the box takes a text row's height and the
            // badge sits proud of the corner it is meant to hug.
            style={{ ...NO_SHRINK, lineHeight: 0 }}
        >
            <AppIcon
                icon={icon}
                size={SUBJECT_SIZE}
                color={CONTROL_ICON_COLOR}
            />
            {/* Sized off no IconSize step: there is none this small. */}
            <Box
                component={status}
                pos="absolute"
                right={-BADGE_OVERHANG}
                bottom={-BADGE_OVERHANG}
                fz={BADGE_SIZE}
                c={color}
                weight="bold"
            />
        </Box>
    );
}
