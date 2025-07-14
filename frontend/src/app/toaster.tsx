import { Icon, Intent, OverlayToaster } from "@blueprintjs/core";

export const toaster = await OverlayToaster.create({
    maxToasts: 3
});

export const infoToastArgs = {
    icon: <Icon icon="info-sign" />,
    intent: Intent.PRIMARY
};

export const successToastArgs = {
    icon: <Icon icon="tick-circle" />,
    intent: Intent.SUCCESS
};

export const errorToastArgs = {
    icon: <Icon icon="error" />,
    intent: Intent.DANGER
};

export function showInfoToast(message: string, key?: string): string {
    return toaster.show(
        {
            ...infoToastArgs,
            message
        },
        key
    );
}

export function showSuccessToast(message: string, key?: string): string {
    return toaster.show(
        {
            ...successToastArgs,
            message
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
            ...errorToastArgs,
            message
        },
        key
    );
}
