import { Box } from "@mantine/core";
import type { Icon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { AppIcon } from "./app-icon";
import { StatusIcon } from "./status-icon";
import { type Status } from "../lib/status";
import { CONTROL_ICON_COLOR, IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";

interface BadgedIconProps {
    /** What the status is about: the target tab, a build, a connection. */
    icon: Icon;
    status: Status;
}

/** The size of any other icon-only control in the bar. */
const SUBJECT_SIZE = IconSize.CONTROL;

const BADGE_OVERHANG = 4;

/** An icon with its {@link StatusIcon} on the corner, sized to line up with plain icons. */
export function BadgedIcon(props: BadgedIconProps): ReactNode {
    const { icon, status } = props;
    return (
        <Box
            pos="relative"
            w={SUBJECT_SIZE}
            h={SUBJECT_SIZE}
            className={styles.noShrink}
            // Or the box takes a text row's height and the badge floats off the corner.
            lh={0}
        >
            <AppIcon
                icon={icon}
                size={SUBJECT_SIZE}
                color={CONTROL_ICON_COLOR}
            />
            <Box
                pos="absolute"
                right={-BADGE_OVERHANG}
                bottom={-BADGE_OVERHANG}
                lh={0}
            >
                <StatusIcon
                    status={status}
                    size={IconSize.BADGE}
                    weight="bold"
                    raised={false}
                />
            </Box>
        </Box>
    );
}
