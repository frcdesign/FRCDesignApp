import { Box, Center, Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
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
 * The width the navbar needs before the app's name earns its room. Under it the
 * name is what gives way — the page you are on and the controls beside it are
 * what the bar is for — and an initial and an ellipsis say less than the tile
 * already does. Measured against the rest of the row; see `TABS_MIN_WIDTH`.
 */
const WORDMARK_MIN_WIDTH = 500;

/** The book and the app's name, in every navbar, linking out to FRCDesign.org. */
export function AppBrand(): ReactNode {
    const hasRoomForWordmark = useHasRoom(WORDMARK_MIN_WIDTH);

    return (
        // `miw` so the name can give: a flex item will not shrink below the
        // longest word it holds unless it is allowed to.
        <Group gap="xs" wrap="nowrap" h="100%" miw={0}>
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
                    // The row's give between here and the cutoff above: the
                    // app's own name shortens before the page's does.
                    truncate
                >
                    FRCDesignApp
                </Text>
            )}
        </Group>
    );
}
