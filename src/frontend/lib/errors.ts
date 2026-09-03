import { ApiErrorKind, type ApiErrorBody } from "@backend/lib/api-error";
import { renderNotification, showErrorToast } from "./notifications";
import { startSignIn } from "../features/auth/sign-in";

/**
 * A failure worth telling the user about, from the backend or raised here.
 * `body` is the discriminated shape the backend sends, read by its kind.
 */
export class AppError extends Error {
    constructor(readonly body: ApiErrorBody) {
        super(body.message);
        this.name = "AppError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Raised on the client, with wording already written for the user. */
export function appError(message: string): AppError {
    return new AppError({ kind: ApiErrorKind.HANDLED, message });
}

/** The kinds whose message was written for the user to read. */
const SPOKEN_KINDS: ApiErrorBody["kind"][] = [
    ApiErrorKind.HANDLED,
    ApiErrorKind.SIGN_IN_REQUIRED,
    ApiErrorKind.FORBIDDEN
];

/** Builds an {@link AppError} from a failed /api response body. */
export function fromApiErrorBody(body: unknown): AppError {
    const parsed = body as Partial<ApiErrorBody> | undefined;
    const kind = SPOKEN_KINDS.find((spoken) => spoken === parsed?.kind);
    // Anything unrecognized is a failure we did not write wording for.
    return new AppError({
        kind: kind ?? ApiErrorKind.INTERNAL,
        message: parsed?.message ?? ""
    });
}

export function getAppErrorHandler(defaultMessage: string, toastId?: string) {
    return (error: Error) => handleAppError(error, defaultMessage, toastId);
}

/**
 * Only an error worded for the user shows its own message; anything else gets
 * `defaultMessage`. One the caller can act on offers them that action.
 */
export function handleAppError(
    error: Error,
    defaultMessage: string,
    toastKey?: string
) {
    if (error instanceof AppError) {
        switch (error.body.kind) {
            case ApiErrorKind.SIGN_IN_REQUIRED:
                showErrorToast(
                    renderNotification(error.body.message, {
                        text: "Sign in",
                        onClick: startSignIn
                    }),
                    toastKey
                );
                return;
            case ApiErrorKind.HANDLED:
            case ApiErrorKind.FORBIDDEN:
                showErrorToast(error.body.message, toastKey);
                return;
            case ApiErrorKind.INTERNAL:
                break;
        }
    }
    showErrorToast(defaultMessage, toastKey);
}
