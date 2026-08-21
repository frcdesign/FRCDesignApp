import { notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { CheckCircle, Info, XCircle } from "@phosphor-icons/react";
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

/** Shows a toast, replacing any existing toast with the same id. */
function showToast(config: ToastConfig): string {
    // Mantine's `show` no-ops when a toast with this id already exists, so hide
    // it first to replace it (e.g. a loading toast upgraded to success).
    if (config.id) {
        notifications.hide(config.id);
    }
    return notifications.show({
        id: config.id,
        color: config.color,
        icon: config.icon,
        message: config.message,
        loading: config.loading,
        autoClose: config.autoClose,
        withCloseButton: config.withCloseButton
    });
}

export function showInfoToast(message: string, id?: string): string {
    return showToast({
        id,
        color: "blue",
        icon: <Info size={IconSize.MEDIUM} />,
        message
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
        icon: <CheckCircle size={IconSize.MEDIUM} />,
        message
    });
}

export function showErrorToast(message: string, id?: string): string {
    return showToast({
        id,
        color: "red",
        icon: <XCircle size={IconSize.MEDIUM} />,
        message
    });
}
