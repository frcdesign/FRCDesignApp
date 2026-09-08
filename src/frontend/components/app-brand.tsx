import { Box, Center, Divider, Group, Text } from "@mantine/core";
import { type ReactNode } from "react";
import {
    FontWeight,
    IconSize,
    maskedImage,
    NAVBAR_DIVIDER_COLOR,
    PrimaryColor,
    RADIUS
} from "../lib/style-constants";

import frcDesignBook from "/frc-design-book.svg";

/**
 * The book and the app's name, in the navbar of both the panel and the
 * dashboard. The book links out to FRCDesign.org; the name does not, since
 * clicking the app's own name should not leave it. Closed by a rule, so the
 * name reads as the app rather than as the first tab.
 */
export function AppBrand(): ReactNode {
    return (
        <Group gap="xs" wrap="nowrap" h="100%" pr="xs">
            <Center
                component="a"
                href="https://frcdesign.org"
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
            <Text fw={FontWeight.BOLD} size="sm" mr="xs">
                FRCDesignApp
            </Text>
            {/* Mantine's default divider is tuned for a white page and all
                but disappears on the navbar's own gray. */}
            <Divider
                orientation="vertical"
                my="sm"
                color={NAVBAR_DIVIDER_COLOR}
            />
        </Group>
    );
}
