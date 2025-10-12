import { showErrorToast } from "../common/toaster";

/**
 * Errors which are generated and thrown on the client.
 * Unlike other errors, the message is displayed directly to the user.
 */
export class HandledError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Used to indicate that an error has occurred, but also that no action should be taken.
 * Allows a mutation to "quit out" without triggering onError behavior.
 */
// export class NoError extends Error {
//     constructor() {
//         super("No error");
//         Object.setPrototypeOf(this, new.target.prototype);
//     }
// }

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
        showErrorToast(error.message, toastKey);
        return;
    }
    // else if (error instanceof NoError) {
    //     return;
    // }
    showErrorToast(defaultMessage, toastKey);
}

/**
 * Errors reported by the backend and handled on the client.
 */
export class ReportedError extends Error {
    public type: string;

    constructor(type: string) {
        super(type);
        Object.setPrototypeOf(this, new.target.prototype);
        this.type = type;
    }
}
