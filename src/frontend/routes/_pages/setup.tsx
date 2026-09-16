import {
    Container,
    Group,
    Image,
    List,
    Stack,
    Text,
    Title
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { OpenUrlButton } from "../../components/open-url-button";
import { APP_STORE_URL } from "../../lib/url";

import frcDesignAppIcon from "/frc-design-app-prod.svg";

export const Route = createFileRoute("/_pages/setup")({
    component: Setup
});

/** Where "Get the app" lands: what to do to end up with the app in Onshape. */
function Setup(): ReactNode {
    return (
        // Read outside Onshape's panel, so it is given a page's width rather
        // than run to whatever the window happens to be.
        <Container size="sm" py="xl">
            <Stack gap="lg">
                <Stack gap="xs">
                    <Title order={2}>Get the FRCDesignApp</Title>
                    <Text c="dimmed">
                        The FRCDesignApp runs inside Onshape, where it inserts
                        parts straight into the document you are working in.
                    </Text>
                </Stack>
                <List type="ordered" spacing="lg">
                    <List.Item>
                        <Stack gap="xs" align="flex-start">
                            <Text>
                                Subscribe to the FRCDesignApp in the Onshape App
                                Store
                            </Text>
                            <OpenUrlButton
                                text="Open the App Store"
                                url={APP_STORE_URL}
                            />
                        </Stack>
                    </List.Item>
                    <List.Item>
                        Open any Part Studio or Assembly in Onshape
                    </List.Item>
                    <List.Item>
                        <Stack gap="xs" align="flex-start">
                            <Text>
                                Find the FRCDesignApp in the sidebar on the
                                right side of the screen
                            </Text>
                            <AppIconHint />
                        </Stack>
                    </List.Item>
                    <List.Item>
                        Search for parts, configure them, and insert them into
                        your document
                    </List.Item>
                </List>
            </Stack>
        </Container>
    );
}

/** The blue book to look for, at the size Onshape's sidebar draws it. */
const SIDEBAR_ICON_SIZE = 40;

function AppIconHint(): ReactNode {
    return (
        <Group gap="xs" wrap="nowrap">
            <Image
                src={frcDesignAppIcon}
                w={SIDEBAR_ICON_SIZE}
                h={SIDEBAR_ICON_SIZE}
                alt="The FRCDesignApp's blue book icon"
            />
            <Text size="sm" c="dimmed">
                Look for this blue book
            </Text>
        </Group>
    );
}
