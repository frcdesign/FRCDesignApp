import { notifications } from "@mantine/notifications";
import {
    IconInfoCircle,
    IconCircleCheck,
    IconCircleX,
    IconAlertTriangle,
    ReactNode
} from "@tabler/icons-react";
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
            <span>{message}</span>
            <Button size="compact-sm" variant="subtle" onClick={action.onClick}>
                {action.text}
            </Button>
        </Group>
    );
}

export function showInfoToast(message: string, id?: string): string {
    return notifications.show({
        id,
        color: "blue",
        icon: <IconInfoCircle size={IconSize.MEDIUM} />,
        message
    });
}

export function showLoadingToast(message: string, id: string): string {
    return notifications.show({
        id,
        color: "blue",
        loading: true,
        message,
        allowClose: false,
        autoClose: false
    });
}

export function showSuccessToast(message: string, id?: string): string {
    return notifications.show({
        id,
        color: "green",
        icon: <IconCircleCheck size={IconSize.MEDIUM} />,
        message
    });
}

export function showWarningToast(message: string, id?: string): string {
    return notifications.show({
        id,
        color: "yellow",
        icon: <IconAlertTriangle size={IconSize.MEDIUM} />,
        message
    });
}

export function showErrorToast(message: string, id?: string): string {
    return notifications.show({
        id,
        color: "red",
        icon: <IconCircleX size={IconSize.MEDIUM} />,
        message
    });
}
