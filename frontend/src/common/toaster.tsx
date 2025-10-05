import { Intent, OverlayToaster } from "@blueprintjs/core";

export const toaster = await OverlayToaster.create({
    maxToasts: 3,
    position: "bottom"
});

export function closeToast(key: string) {
    toaster.dismiss(key);
}

export function showInfoToast(message: string, key?: string): string {
    return toaster.show(
        {
            icon: "info-sign",
            intent: Intent.PRIMARY,
            message
        },
        key
    );
}

/**
 * Displays a loading toast with no timeout.
 */
export function showLoadingToast(message: string, key: string): string {
    return toaster.show(
        {
            intent: "primary",
            icon: "repeat",
            timeout: -1,
            message
        },
        key
    );
}

export function showSuccessToast(message: string, key?: string): string {
    return toaster.show(
        {
            icon: "tick-circle",
            intent: Intent.SUCCESS,
            message,
            timeout: 3000
        },
        key
    );
}

/**
 * Shows a toaster with an error message.
 * @param message : The message to display.
 */
export function showErrorToast(message: string, key?: string): string {
    return toaster.show(
        {
            icon: "error",
            intent: Intent.DANGER,
            message
        },
        key
    );
}
