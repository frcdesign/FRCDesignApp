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

interface ToastOptions {
    /** A repeat with the same id updates the toast. */
    id?: string;
    /** False keeps it up until dismissed, for one somebody has to act on. */
    autoClose?: number | false;
}

const STATUS_TOAST_COLOR: Record<Status, string> = {
    [Status.SUCCESS]: "green",
    [Status.INFO]: "blue",
    [Status.WARNING]: "yellow",
    [Status.ERROR]: "red"
};

function showStatusToast(
    status: Status,
    message: ReactNode,
    options: ToastOptions
): string {
    return showToast({
        color: STATUS_TOAST_COLOR[status],
        icon: (
            <StatusIcon
                status={status}
                size={IconSize.MEDIUM}
                color="white"
                raised={false}
            />
        ),
        message,
        ...options
    });
}

export function showInfoToast(
    message: ReactNode,
    options: ToastOptions = {}
): string {
    return showStatusToast(Status.INFO, message, options);
}

export function showLoadingToast(message: string, id: string): string {
    return showToast({
        id,
        color: STATUS_TOAST_COLOR[Status.INFO],
        loading: true,
        message,
        autoClose: false,
        withCloseButton: false
    });
}

export function showSuccessToast(message: string, id?: string): string {
    return showStatusToast(Status.SUCCESS, message, { id });
}

export function showErrorToast(
    message: ReactNode,
    id?: string,
    options: Omit<ToastOptions, "id"> = {}
): string {
    return showStatusToast(Status.ERROR, message, { id, ...options });
}

/** Something went through, but not all of it. */
export function showWarningToast(
    message: ReactNode,
    id?: string,
    options: Omit<ToastOptions, "id"> = {}
): string {
    return showStatusToast(Status.WARNING, message, { id, ...options });
}
