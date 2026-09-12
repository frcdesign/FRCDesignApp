import { Box, Group, type MantineSpacing, Stack } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import { BORDER, FRAME_BACKGROUND } from "../lib/style-constants";

/**
 * Content pinned between the header and the scrolling body, like a preview
 * image. The body below supplies the space under it.
 */
export function AppModalTop(props: PropsWithChildren): ReactNode {
    return (
        <Box p="sm" pb={0} flex="0 0 auto">
            {props.children}
        </Box>
    );
}

interface AppModalBodyProps extends PropsWithChildren {
    /** Space between children; content that spaces itself should pass 0. */
    gap?: MantineSpacing;
}

/**
 * A modal's content, padded away from the header and footer framing it. The one
 * part of a modal that scrolls — `mih` because a flex item otherwise floors at
 * its content height, which pushes the footer off the modal instead.
 */
export function AppModalBody(props: AppModalBodyProps): ReactNode {
    const { gap = "sm", children } = props;
    return (
        <Stack p="sm" gap={gap} flex={1} mih={0} style={{ overflowY: "auto" }}>
            {children}
        </Stack>
    );
}

/** A modal's actions. A lone child sits at the end; two split the row. */
export function AppModalFooter(props: PropsWithChildren): ReactNode {
    return (
        <Group
            justify="space-between"
            wrap="nowrap"
            p="sm"
            bg={FRAME_BACKGROUND}
            flex="0 0 auto"
            style={{ borderTop: BORDER }}
        >
            {props.children}
        </Group>
    );
}
