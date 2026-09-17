import { Box, ThemeIcon } from "@mantine/core";
import type { Icon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { AppIcon } from "./app-icon";
import {
    FRAME_BACKGROUND,
    IconSize,
    NO_SHRINK,
    StatusColor
} from "../lib/style-constants";

export interface StatusIconProps {
    /** What the status is about: the target tab, a build, a connection. */
    icon: Icon;
    /** The state itself, badged on the corner — a tick, a cross, a warning. */
    status: Icon;
    color: StatusColor | string;
    /** What a screen reader reads: the pair carries meaning on its own. */
    label: string;
    /**
     * The surface the badge is cut out of, so it separates from the icon under
     * it. The bars this sits in are all frames.
     * @default FRAME_BACKGROUND
     */
    background?: string;
}

const SUBJECT_SIZE = IconSize.CONTROL;

/** Big enough that a tick and a cross can be told apart at a glance. */
const BADGE_SIZE = 14;

/** The ring of surface that keeps the two glyphs from running together. */
const BADGE_RING = 2;

/**
 * How far the badge sits past the subject's corner. The rest of it overlaps,
 * and the subject has to stay recognizable under that.
 */
const BADGE_OVERHANG = 6;

/** Sized for the overhang, so the badge is inside the box the row lays out. */
const BOX_SIZE = SUBJECT_SIZE + BADGE_OVERHANG;

/**
 * A subject icon with its state badged on the corner, told by shape as well as
 * by color — a tick and a cross stay apart where green and yellow do not. Only
 * the badge is colored, so there is one place to read the status off.
 *
 * `autoContrast` is what keeps the glyph legible on a light status color: white
 * on green, but near-black on yellow, which white does not survive.
 */
export function StatusIcon(props: StatusIconProps): ReactNode {
    const { icon, status, color, label, background } = props;
    return (
        <Box
            pos="relative"
            w={BOX_SIZE}
            h={BOX_SIZE}
            aria-label={label}
            style={NO_SHRINK}
        >
            <Box pos="absolute" top={0} left={0} style={{ lineHeight: 0 }}>
                <AppIcon icon={icon} size={SUBJECT_SIZE} />
            </Box>
            <Box
                pos="absolute"
                right={0}
                bottom={0}
                p={BADGE_RING}
                bg={background ?? FRAME_BACKGROUND}
                // Zero line height, or the box takes a text row's height and
                // the badge sits proud of the corner it is meant to hug.
                style={{ borderRadius: "50%", lineHeight: 0 }}
            >
                <ThemeIcon
                    color={color}
                    size={BADGE_SIZE}
                    radius="xl"
                    autoContrast
                >
                    {/* Sized against the badge rather than off IconSize, and
                        inheriting the contrast color ThemeIcon picked. */}
                    <Box component={status} fz={BADGE_SIZE - 4} weight="bold" />
                </ThemeIcon>
            </Box>
        </Box>
    );
}
