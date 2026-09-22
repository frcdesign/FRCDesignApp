import { Box, Group, type MantineSpacing, Modal, Stack } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import { BORDER, FRAME_BACKGROUND } from "../lib/style-constants";

const COLUMN = { display: "flex", flexDirection: "column" } as const;

/** Passes the card's capped height down to the body, which is what scrolls. */
const FILL_COLUMN = { ...COLUMN, flex: 1, minHeight: 0 } as const;

/**
 * The framing both halves of the app's modals draw: a bordered card that clips
 * rather than scrolls, so the body below scrolls and the footer stays put.
 */
export const APP_MODAL_STYLES = {
    content: { border: BORDER, overflow: "hidden", ...COLUMN },
    header: {
        background: FRAME_BACKGROUND,
        borderBottom: BORDER,
        padding: "var(--mantine-spacing-sm)",
        // Otherwise a Mantine minimum, not the padding, sets the height.
        minHeight: 0
    },
    // Shrinkable, so a long title ellipsizes rather than running under the
    // close button.
    title: { minWidth: 0 },
    body: { padding: 0, ...FILL_COLUMN }
};

interface AppModalProps extends PropsWithChildren {
    opened: boolean;
    /** Unused by a modal that cannot be dismissed. */
    onClose?: () => void;
    title?: ReactNode;
    size?: string | number;
    /** False for a modal whose content is the only way out. @default true */
    dismissible?: boolean;
}

/**
 * A modal held open by state rather than by the manager, framed like the rest
 * of the app; `openAppModal` is the imperative half. Its body belongs in an
 * `AppModalBody`, and its actions, when it has any, in an `AppModalFooter`.
 */
export function AppModal(props: AppModalProps): ReactNode {
    const {
        opened,
        onClose,
        title,
        size,
        dismissible = true,
        children
    } = props;

    return (
        <Modal
            opened={opened}
            onClose={onClose ?? (() => undefined)}
            title={title}
            size={size}
            centered
            withCloseButton={dismissible}
            closeOnClickOutside={dismissible}
            closeOnEscape={dismissible}
            styles={APP_MODAL_STYLES}
        >
            {/* Takes the focus the trap would otherwise land on the first
                control, which reads as that one being pre-selected. */}
            <div
                data-autofocus
                tabIndex={-1}
                style={{ outline: "none", ...FILL_COLUMN }}
            >
                {children}
            </div>
        </Modal>
    );
}

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
