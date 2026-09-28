import { Box } from "@mantine/core";
import type { Icon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { AppIcon } from "./app-icon";
import {
    CONTROL_ICON_COLOR,
    IconSize,
    StatusColor
} from "../lib/style-constants";
import styles from "../lib/styles.module.css";

interface StatusIconProps {
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

const BADGE_OVERHANG = 4;

/** A tick and a warning differ by shape, not just color. Sized to the subject so it lines up with plain icons. */
export function StatusIcon(props: StatusIconProps): ReactNode {
    const { icon, status, color } = props;
    return (
        <Box
            pos="relative"
            w={SUBJECT_SIZE}
            h={SUBJECT_SIZE}
            // Or the box takes a text row's height and the badge floats off the corner.
            className={styles.noShrink}
            lh={0}
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
