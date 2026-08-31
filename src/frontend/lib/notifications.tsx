import { notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { CheckCircleIcon, InfoIcon, XCircleIcon } from "@phosphor-icons/react";
import { IconSize } from "./style-constants";
import { Group, Button } from "@mantine/core";

export interface NotificationAction {
    text: string;
    onClick: () => void;
}

/**
 * Renders a Notification with an added Action button.
 */
export function renderNotification(
    message: ReactNode,
    action: NotificationAction | undefined
) {
    if (!action) {
        return message;
    }
    return (
        <Group justify="space-between" wrap="nowrap" gap="sm">
            {/* Only reachable on a window too narrow for the row: the message
                is what gives, and the button keeps its label intact. */}
            <span style={{ minWidth: 0 }}>{message}</span>
            <Button
                size="compact-sm"
                variant="subtle"
                onClick={action.onClick}
                style={{ flexShrink: 0 }}
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

/** Ids currently on screen, so a repeat updates rather than replaces. */
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

    // Updating keeps the toast in place, so a loading toast becoming a success
    // one reads as the same toast rather than one leaving and another arriving.
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
    /** Repeats with the same id update the toast rather than stacking one up. */
    id?: string;
    autoClose?: number | false;
}

export function showInfoToast(
    message: ReactNode,
    options: InfoToastOptions = {}
): string {
    return showToast({
        color: "blue",
        icon: <InfoIcon size={IconSize.MEDIUM} />,
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
        icon: <CheckCircleIcon size={IconSize.MEDIUM} />,
        message
    });
}

export function showErrorToast(message: ReactNode, id?: string): string {
    return showToast({
        id,
        color: "red",
        icon: <XCircleIcon size={IconSize.MEDIUM} />,
        message
    });
}
