import { Box, Container, List, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { NavbarRow } from "../../components/app-navbar";
import { OpenUrlButton } from "../../components/open-url-button";
import { APP_STORE_URL } from "../../lib/url";

import frcDesignAppIcon from "/frc-design-app-prod.svg";

export const Route = createFileRoute("/_pages/setup")({
    component: Setup
});

/** Where "Instructions" lands: what to do to end up with the app in Onshape. */
function Setup(): ReactNode {
    return (
        <>
            {/* The brand alone: there is nowhere else to go from here. */}
            <NavbarRow />
            {/* Read outside Onshape's panel, so it is given a page's width
                rather than run to whatever the window happens to be. */}
            <Container size="sm" py="xl">
                <Stack gap="lg">
                    <Stack gap="xs">
                        <Title order={2}>Get the FRCDesignApp</Title>
                        <Text c="dimmed">
                            The FRCDesignApp runs directly in Onshape, making it
                            easy to add parts directly to your CAD.
                        </Text>
                    </Stack>
                    {/* A list rather than a Stepper: a step renders as a
                        button, which cannot hold the App Store button that
                        belongs to the first one. */}
                    <List type="ordered" spacing="lg">
                        <List.Item>
                            <Stack gap="xs" align="flex-start">
                                <Text>
                                    Subscribe to the FRCDesignApp in the Onshape
                                    App Store.
                                </Text>
                                <OpenUrlButton
                                    text="Open the App Store"
                                    url={APP_STORE_URL}
                                />
                            </Stack>
                        </List.Item>
                        <List.Item>
                            Open any Part Studio or Assembly in Onshape.
                        </List.Item>
                        <List.Item>
                            Find the FRCDesignApp in the sidebar on the right
                            side of the screen (Look for the
                            <AppIconMark />
                            icon).
                        </List.Item>
                        <List.Item>
                            Search for parts and add them to your document.
                        </List.Item>
                    </List>
                </Stack>
            </Container>
        </>
    );
}

/** Sized to the text it sits in rather than to Onshape's sidebar. */
const ICON_MARK_SIZE = 22;

/** The blue book to look for, shown inline where the step names it. */
function AppIconMark(): ReactNode {
    return (
        <Box
            component="img"
            src={frcDesignAppIcon}
            alt="the FRCDesignApp's icon"
            w={ICON_MARK_SIZE}
            h={ICON_MARK_SIZE}
            // Keeps the parentheses off the icon.
            mx={4}
            // Centered on the text; on the baseline a square mark hangs low.
            display="inline-block"
            style={{ verticalAlign: "middle" }}
        />
    );
}
