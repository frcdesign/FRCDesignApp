import { notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { StatusIcon } from "../components/status-icon";
import { Status } from "./status";
import { IconSize } from "./style-constants";
import { Box, Group, Button } from "@mantine/core";
import styles from "./styles.module.css";

export interface NotificationAction {
    text: string;
    onClick: () => void;
}

export function renderNotification(
    message: ReactNode,
    action: NotificationAction | undefined
) {
    if (!action) {
        return message;
    }
    return (
        <Group justify="space-between" gap="sm">
            {/* Only reachable on a window too narrow for the row: the message
                is what gives, and the button keeps its label intact. */}
            <Box component="span" miw={0}>
                {message}
            </Box>
            <Button
                size="compact-sm"
                variant="subtle"
                onClick={action.onClick}
                className={styles.noShrink}
            >
                {action.text}
            </Button>
        </Group>
    );
}

interface ToastConfig {
    id?: string;
    color: string;
    icon?: ReactNode;
    message: ReactNode;
    loading?: boolean;
    autoClose?: number | false;
    withCloseButton?: boolean;
}

const liveToasts = new Set<string>();

/** Shows a toast, updating any existing toast with the same id. */
function showToast(config: ToastConfig): string {
    const props = {
        id: config.id,
        color: config.color,
        icon: config.icon,
        message: config.message,
        loading: config.loading,
        autoClose: config.autoClose,
        withCloseButton: config.withCloseButton
    };

    // Updated in place, so a loading toast turning into a success reads as one toast.
    if (config.id && liveToasts.has(config.id)) {
        notifications.update(props);
        return config.id;
    }

    const id = notifications.show({
        ...props,
        onClose: () => liveToasts.delete(id)
    });
    liveToasts.add(id);
    return id;
}

interface InfoToastOptions {
    /** A repeat with the same id updates the toast. */
    id?: string;
    autoClose?: number | false;
}

export function showInfoToast(
    message: ReactNode,
    options: InfoToastOptions = {}
): string {
    return showToast({
        color: "blue",
        icon: (
            <StatusIcon
                status={Status.INFO}
                size={IconSize.MEDIUM}
                color="white"
                raised={false}
            />
        ),
        message,
        ...options
    });
}

export function showLoadingToast(message: string, id: string): string {
    return showToast({
        id,
        color: "blue",
        loading: true,
        message,
        autoClose: false,
        withCloseButton: false
    });
}

export function showSuccessToast(message: string, id?: string): string {
    return showToast({
        id,
        color: "green",
        icon: (
            <StatusIcon
                status={Status.SUCCESS}
                size={IconSize.MEDIUM}
                color="white"
                raised={false}
            />
        ),
        message
    });
}

interface ProblemToastOptions {
    /** False keeps it up until dismissed, for one somebody has to act on. */
    autoClose?: number | false;
}

export function showErrorToast(
    message: ReactNode,
    id?: string,
    options: ProblemToastOptions = {}
): string {
    return showToast({
        id,
        color: "red",
        icon: (
            <StatusIcon
                status={Status.ERROR}
                size={IconSize.MEDIUM}
                color="white"
                raised={false}
            />
        ),
        message,
        ...options
    });
}

/** Something went through, but not all of it. */
export function showWarningToast(
    message: ReactNode,
    id?: string,
    options: ProblemToastOptions = {}
): string {
    return showToast({
        id,
        color: "yellow",
        icon: (
            <StatusIcon
                status={Status.WARNING}
                size={IconSize.MEDIUM}
                color="white"
                raised={false}
            />
        ),
        message,
        ...options
    });
}
