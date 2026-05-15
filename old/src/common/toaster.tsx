import { createClientOnlyFn } from "@tanstack/react-start";
import { Intent, OverlayToaster } from "@blueprintjs/core";

const toaster = await OverlayToaster.create({
    maxToasts: 3,
    position: "bottom"
});

export const showToast = createClientOnlyFn(toaster.show);

export const closeToast = createClientOnlyFn((key: string) => {
    toaster.dismiss(key);
});

export const showInfoToast = createClientOnlyFn(
    (message: string, key?: string): string =>
        toaster.show(
            {
                icon: "info-sign",
                intent: Intent.PRIMARY,
                message
            },
            key
        )
);

export const showLoadingToast = createClientOnlyFn(
    (message: string, key: string): string =>
        toaster.show(
            {
                intent: "primary",
                icon: "repeat",
                timeout: -1,
                message
            },
            key
        )
);

export const showSuccessToast = createClientOnlyFn(
    (message: string, key?: string): string =>
        toaster.show(
            {
                icon: "tick-circle",
                intent: Intent.SUCCESS,
                message,
                timeout: 3000
            },
            key
        )
);

export const showErrorToast = createClientOnlyFn(
    (message: string, key?: string): string =>
        toaster.show(
            {
                icon: "error",
                intent: Intent.DANGER,
                message
            },
            key
        )
);
