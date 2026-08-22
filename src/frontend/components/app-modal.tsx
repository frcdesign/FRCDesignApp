import { Group, type MantineSpacing, Stack } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import {
    BORDER,
    CHROME_BACKGROUND,
    CHROME_PADDING
} from "../lib/style-constants";

interface AppModalBodyProps extends PropsWithChildren {
    /** Space between children; content that spaces itself should pass 0. */
    gap?: MantineSpacing;
}

/** A modal's content, padded away from the chrome framing it. */
export function AppModalBody(props: AppModalBodyProps): ReactNode {
    return (
        <Stack p="md" gap={props.gap}>
            {props.children}
        </Stack>
    );
}

/**
 * A modal's actions, flush against the bottom on the header's surface. Lay
 * children out as leading and trailing groups; a lone child sits at the end.
 */
export function AppModalFooter(props: PropsWithChildren): ReactNode {
    return (
        <Group
            justify="space-between"
            wrap="nowrap"
            bg={CHROME_BACKGROUND}
            style={{ padding: CHROME_PADDING, borderTop: BORDER }}
        >
            {props.children}
        </Group>
    );
}
