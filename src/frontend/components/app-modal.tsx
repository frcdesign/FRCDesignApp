import { Box, Group, type MantineSpacing, Modal, Stack } from "@mantine/core";
import { PropsWithChildren, ReactNode } from "react";
import styles from "../lib/styles.module.css";
import classes from "./app-modal.module.css";

/** The framing both halves of the app's modals draw. */
export const APP_MODAL_CLASSES = {
    content: classes.content,
    header: `${classes.header} ${styles.frame}`,
    title: classes.title,
    body: classes.body
};

/** What every modal's content sits in, so its body can scroll. */
export function AppModalContent(props: PropsWithChildren): ReactNode {
    // `data-autofocus` takes the focus the trap would otherwise land on the
    // first control, which reads as that one being pre-selected.
    return (
        <div data-autofocus tabIndex={-1} className={classes.fill}>
            {props.children}
        </div>
    );
}

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
            classNames={APP_MODAL_CLASSES}
        >
            <AppModalContent>{children}</AppModalContent>
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
 * A modal's content, padded away from the header and footer framing it: the
 * one part of a modal that scrolls.
 */
export function AppModalBody(props: AppModalBodyProps): ReactNode {
    const { gap = "sm", children } = props;
    return (
        <Stack p="sm" gap={gap} className={classes.scroll}>
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
            flex="0 0 auto"
            className={`${styles.frame} ${styles.dividerTop}`}
        >
            {props.children}
        </Group>
    );
}
