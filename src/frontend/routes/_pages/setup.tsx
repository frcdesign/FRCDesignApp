import { Box, Container, Stack, Stepper, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { NavbarRow } from "../../components/app-navbar";
import { OpenUrlButton } from "../../components/open-url-button";
import { APP_STORE_URL } from "../../lib/url";

import frcDesignAppIcon from "/frc-design-app-prod.svg";

export const Route = createFileRoute("/_pages/setup")({
    component: Setup
});

/** Where "Get app" lands: what to do to end up with the app in Onshape. */
function Setup(): ReactNode {
    return (
        <>
            {/* The brand alone: there is nowhere else to go from here, and the
                page is reached from outside the app as often as from in it. */}
            <NavbarRow />
            <Container size="sm" py="xl">
                <Stack gap="lg">
                    <Stack gap="xs">
                        <Title order={2}>Get the FRCDesignApp</Title>
                        <Text c="dimmed">
                            The FRCDesignApp runs directly in Onshape, making it
                            easy to add parts directly to your CAD.
                        </Text>
                    </Stack>
                    <SetupSteps />
                    {/* Outside the stepper, not in step one: a step renders as
                        a button, and a button cannot hold another. */}
                    <Box>
                        <OpenUrlButton
                            text="Open the App Store"
                            url={APP_STORE_URL}
                        />
                    </Box>
                </Stack>
            </Container>
        </>
    );
}

/**
 * Instructions rather than progress, so no step is active: nothing here knows
 * how far along the reader is, and marking one would claim otherwise.
 */
const NO_ACTIVE_STEP = -1;

function SetupSteps(): ReactNode {
    return (
        <Stepper active={NO_ACTIVE_STEP} orientation="vertical" size="sm">
            <Stepper.Step label="Subscribe to the FRCDesignApp in the Onshape App Store." />
            <Stepper.Step label="Open any Part Studio or Assembly in Onshape." />
            <Stepper.Step
                label={
                    <>
                        Find the FRCDesignApp in the sidebar on the right side
                        of the screen (
                        <AppIconMark />
                        ).
                    </>
                }
            />
            <Stepper.Step label="Search for parts, configure them, and insert them into your document!" />
        </Stepper>
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
            // Centered on the text rather than sat on its baseline, which
            // leaves a square mark hanging below the line.
            display="inline-block"
            style={{ verticalAlign: "middle" }}
        />
    );
}
