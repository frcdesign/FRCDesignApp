import { Intent, OverlayToaster } from "@blueprintjs/core";

const toaster = await OverlayToaster.create({
    maxToasts: 3,
    position: "bottom"
});

export function showToast(
    ...args: Parameters<typeof toaster.show>
): ReturnType<typeof toaster.show> {
    return toaster.show(...args);
}

export function closeToast(key: string): void {
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
