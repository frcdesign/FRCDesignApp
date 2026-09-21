import { Box, Center, Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { useNeedsSignIn } from "../features/auth/access-level";
import { useHasRoom } from "../lib/layout";
import {
    FontWeight,
    IconSize,
    maskedImage,
    NO_SHRINK,
    PrimaryColor,
    RADIUS
} from "../lib/style-constants";

import frcDesignBook from "/frc-design-book.svg";

/** The site the app belongs to, which both halves of the brand link out to. */
const FRC_DESIGN_URL = "https://frcdesign.org";

/**
 * Where the name stops fitting beside the rest of the row, measured: under it
 * the tile stands in, and the name is never shown part-way.
 */
const WORDMARK_MIN_WIDTH = 440;

/**
 * What the sign-in button takes out of the row while it is showing. The only
 * thing in the bar whose width comes and goes, and never there in the panel —
 * see `TABS_MIN_WIDTH` for what the rest of the row is measured as.
 */
const SIGN_IN_WIDTH = 100;

/** The book and the app's name, in every navbar, linking out to FRCDesign.org. */
export function AppBrand(): ReactNode {
    const needsSignIn = useNeedsSignIn();
    const hasRoomForWordmark = useHasRoom(
        needsSignIn ? WORDMARK_MIN_WIDTH + SIGN_IN_WIDTH : WORDMARK_MIN_WIDTH
    );

    return (
        <Group gap="xs" wrap="nowrap" h="100%">
            <Center
                component="a"
                href={FRC_DESIGN_URL}
                target="_blank"
                aria-label="FRCDesign.org"
                w={IconSize.CONTROL}
                h={IconSize.CONTROL}
                bg={PrimaryColor.FILLED}
                c={PrimaryColor.CONTRAST}
                style={{ borderRadius: RADIUS, ...NO_SHRINK }}
            >
                {/* Masked, not drawn, so the book takes the tile's contrast
                    color rather than the gray in the file. */}
                <Box
                    w={IconSize.SMALL}
                    h={IconSize.SMALL}
                    style={maskedImage(frcDesignBook)}
                />
            </Center>
            {hasRoomForWordmark && (
                <Text
                    component="a"
                    href={FRC_DESIGN_URL}
                    target="_blank"
                    fw={FontWeight.BOLD}
                    size="sm"
                    // The navbar's own text color, rather than a link's blue.
                    c="inherit"
                    td="none"
                >
                    FRCDesignApp
                </Text>
            )}
        </Group>
    );
}
