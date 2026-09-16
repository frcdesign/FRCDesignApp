import { Box, Center, Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
import {
    FontWeight,
    IconSize,
    maskedImage,
    PrimaryColor,
    RADIUS
} from "../lib/style-constants";

import frcDesignBook from "/frc-design-book.svg";

/** The site the app belongs to, which both halves of the brand link out to. */
const FRC_DESIGN_URL = "https://frcdesign.org";

/**
 * The book and the app's name, in every navbar, linking out to FRCDesign.org.
 * `NavbarRow` closes it with a rule wherever something follows it.
 */
export function AppBrand(): ReactNode {
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
                style={{ borderRadius: RADIUS }}
            >
                {/* Masked, not drawn, so the book takes the tile's contrast
                    color rather than the gray in the file. */}
                <Box
                    w={IconSize.SMALL}
                    h={IconSize.SMALL}
                    style={maskedImage(frcDesignBook)}
                />
            </Center>
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
        </Group>
    );
}
