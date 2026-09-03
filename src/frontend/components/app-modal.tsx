import { Group, type MantineSpacing, Stack } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import { BORDER, FRAME_BACKGROUND } from "../lib/style-constants";

interface AppModalBodyProps extends PropsWithChildren {
    /** Space between children; content that spaces itself should pass 0. */
    gap?: MantineSpacing;
}

/** A modal's content, padded away from the header and footer framing it. */
export function AppModalBody(props: AppModalBodyProps): ReactNode {
    const { gap = "sm", children } = props;
    return (
        <Stack p="sm" gap={gap}>
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
            style={{ borderTop: BORDER }}
        >
            {props.children}
        </Group>
    );
}
