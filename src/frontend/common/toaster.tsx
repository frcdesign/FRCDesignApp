import { notifications } from "@mantine/notifications";
import { Button, Group } from "@mantine/core";
import {
    IconInfoCircle,
    IconCircleCheck,
    IconCircleX,
    IconRefresh,
    IconLink
} from "@tabler/icons-react";
import { type ReactNode } from "react";

type ToastIntent = "none" | "primary" | "success" | "warning" | "danger";

/** Maps a Blueprint-style intent to a Mantine color. */
function intentColor(intent?: ToastIntent): string | undefined {
    switch (intent) {
        case "primary":
            return "blue";
        case "success":
            return "green";
        case "warning":
            return "yellow";
        case "danger":
            return "red";
        default:
            return undefined;
    }
}

/** Maps the (Blueprint) icon names still passed by callers to Tabler icons. */
function toastIcon(name?: string): ReactNode {
    switch (name) {
        case "info-sign":
            return <IconInfoCircle size={18} />;
        case "tick-circle":
            return <IconCircleCheck size={18} />;
        case "error":
            return <IconCircleX size={18} />;
        case "repeat":
            return <IconRefresh size={18} />;
        case "link":
            return <IconLink size={18} />;
        default:
            return undefined;
    }
}

interface ToastAction {
    text: string;
    onClick: () => void;
}

interface ToastOptions {
    message: ReactNode;
    intent?: ToastIntent;
    icon?: string;
    /** Timeout in ms. Use a value <= 0 to disable auto-dismiss. */
    timeout?: number;
    action?: ToastAction;
}

/** Tracks keyed toasts that are currently shown so we can update them in place. */
const activeKeys = new Set<string>();

let counter = 0;
function nextId(): string {
    counter += 1;
    return `toast-${Date.now()}-${counter}`;
}

function autoCloseFrom(timeout?: number): number | false {
    if (timeout === undefined) {
        return 4000;
    }
    return timeout <= 0 ? false : timeout;
}

function renderMessage(message: ReactNode, action: ToastAction | undefined, id: string) {
    if (!action) {
        return message;
    }
    return (
        <Group justify="space-between" wrap="nowrap" gap="sm">
            <span>{message}</span>
            <Button
                size="compact-sm"
                variant="subtle"
                onClick={() => {
                    action.onClick();
                    notifications.hide(id);
                }}
            >
                {action.text}
            </Button>
        </Group>
    );
}

/**
 * Shows a toast. Accepts the same option shape callers previously passed to the
 * Blueprint toaster. Returns the toast's key/id.
 */
export function showToast(options: ToastOptions, key?: string): string {
    const id = key ?? nextId();
    notifications.show({
        id,
        color: intentColor(options.intent),
        icon: toastIcon(options.icon),
        message: renderMessage(options.message, options.action, id),
        autoClose: autoCloseFrom(options.timeout)
    });
    return id;
}

export function closeToast(key: string): void {
    activeKeys.delete(key);
    notifications.hide(key);
}

export function showInfoToast(message: string, key?: string): string {
    return transitionOrShow(key, {
        color: "blue",
        icon: <IconInfoCircle size={18} />,
        message,
        autoClose: 4000
    });
}

export function showLoadingToast(message: string, key: string): string {
    activeKeys.add(key);
    notifications.show({
        id: key,
        color: "blue",
        loading: true,
        message,
        autoClose: false,
        withCloseButton: false
    });
    return key;
}

export function showSuccessToast(message: string, key?: string): string {
    return transitionOrShow(key, {
        color: "green",
        loading: false,
        icon: <IconCircleCheck size={18} />,
        message,
        autoClose: 3000,
        withCloseButton: true
    });
}

export function showErrorToast(message: string, key?: string): string {
    return transitionOrShow(key, {
        color: "red",
        loading: false,
        icon: <IconCircleX size={18} />,
        message,
        autoClose: 4000,
        withCloseButton: true
    });
}

type ToastData = Parameters<typeof notifications.show>[0];

/**
 * Updates an existing keyed toast in place (e.g. a loading toast transitioning
 * to success/error), or shows a new toast when there is nothing to update.
 */
function transitionOrShow(key: string | undefined, data: Omit<ToastData, "id">): string {
    if (key && activeKeys.has(key)) {
        activeKeys.delete(key);
        notifications.update({ id: key, ...data });
        return key;
    }
    const id = key ?? nextId();
    notifications.show({ id, ...data });
    return id;
}
