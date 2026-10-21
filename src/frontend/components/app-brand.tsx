import { Box, Center, Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { useNeedsSignIn } from "../features/auth/access-level";
import { useHasRoom } from "../lib/layout";
import {
    FontWeight,
    IconSize,
    maskedImage,
    PrimaryColor
} from "../lib/style-constants";

import frcDesignBook from "/frc-design-book.svg";

/** The site the app belongs to, which both halves of the brand link out to. */
const FRC_DESIGN_URL = "https://frcdesign.org";

/** The book's share of the tile it sits on. */
const BOOK_SCALE = 2 / 3;

interface AppBrandMarkProps {
    /** @default IconSize.CONTROL */
    size?: IconSize;
}

/** The app's mark: its book on a tile in the library's color. */
export function AppBrandMark(props: AppBrandMarkProps): ReactNode {
    const { size = IconSize.CONTROL } = props;

    return (
        <Center
            w={size}
            h={size}
            bg={PrimaryColor.FILLED}
            // The contrast color flips to black on lighter libraries.
            c="white"
            bdrs="sm"
        >
            {/* Masked, not drawn, so the book takes the color above rather
                than the gray in the file. */}
            <Box
                w={size * BOOK_SCALE}
                h={size * BOOK_SCALE}
                style={maskedImage(frcDesignBook)}
            />
        </Center>
    );
}

/**
 * Where the name stops fitting beside the rest of the row, measured: under it
 * the tile stands in, and the name is never shown part-way.
 */
const WORDMARK_MIN_WIDTH = 440;

/**
 * What the sign-in button takes out of the row while it is showing. The only
 * thing in the bar whose width comes and goes, and never there in the panel.
 */
const SIGN_IN_WIDTH = 100;

/** The book and the app's name, in every navbar, linking out to FRCDesign.org. */
export function AppBrand(): ReactNode {
    const needsSignIn = useNeedsSignIn();
    const hasRoomForWordmark = useHasRoom(
        needsSignIn ? WORDMARK_MIN_WIDTH + SIGN_IN_WIDTH : WORDMARK_MIN_WIDTH
    );

    return (
        <Group gap="xs" h="100%">
            <Center component="a" href={FRC_DESIGN_URL} target="_blank">
                <AppBrandMark />
            </Center>
            {hasRoomForWordmark && (
                <Text
                    component="a"
                    href={FRC_DESIGN_URL}
                    target="_blank"
                    fw={FontWeight.BOLD}
                    c="inherit"
                    td="none"
                >
                    FRCDesignApp
                </Text>
            )}
        </Group>
    );
}
