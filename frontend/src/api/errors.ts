import { showErrorToast, showInfoToast } from "../common/toaster";

/**
 * Errors which are generated and thrown on the client.
 * Unlike other errors, the message is displayed directly to the user.
 */
export class HandledError extends Error {
    public isError: boolean;

    constructor(message: string, isError: boolean = true) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.isError = isError;
    }
}

/**
 * Returns a function that handles app errors.
 */
export function getAppErrorHandler(defaultMessage: string, toastKey?: string) {
    return (error: Error) => handleAppError(error, defaultMessage, toastKey);
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
    // else if (error instanceof NoError) {
    //     return;
    // }
    showErrorToast(defaultMessage, toastKey);
}
