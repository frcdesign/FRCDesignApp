import { showErrorToast, showInfoToast } from "./notifications";

/**
 * Errors which are generated and thrown on the client.
 * Unlike other errors, the message is displayed directly to the user.
 */
export class HandledError extends Error {
    public isError: boolean;

    constructor(message: string, isError = true) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.isError = isError;
    }
}

export function getAppErrorHandler(defaultMessage: string, toastId?: string) {
    return (error: Error) => handleAppError(error, defaultMessage, toastId);
}

export function handleAppError(
    error: Error,
    defaultMessage: string,
    toastKey?: string
) {
    if (error instanceof HandledError) {
        if (!error.isError) {
            showInfoToast(error.message, toastKey);
        } else {
            showErrorToast(error.message, toastKey);
        }
        return;
    }
    showErrorToast(defaultMessage, toastKey);
}
