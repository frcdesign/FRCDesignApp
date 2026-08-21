import { ApiErrorKind, type ApiErrorBody } from "@backend/lib/api-error";
import { showErrorToast, showInfoToast } from "./notifications";

/**
 * A failure worth telling the user about, from the backend or raised here.
 * `kind` decides how it is shown, so a caller only supplies the wording for
 * the case it cannot know about.
 */
export class AppError extends Error {
    constructor(
        readonly kind: ApiErrorKind,
        message: string,
        readonly retryAfterSeconds?: number
    ) {
        super(message);
        this.name = "AppError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Raised on the client, with wording already written for the user. */
export function appError(message: string): AppError {
    return new AppError(ApiErrorKind.HANDLED, message);
}

/** Builds an {@link AppError} from a failed /api response body. */
export function fromApiErrorBody(body: unknown): AppError {
    const { kind, message, retryAfterSeconds } = (body ??
        {}) as Partial<ApiErrorBody>;
    switch (kind) {
        case ApiErrorKind.HANDLED:
        case ApiErrorKind.NOTICE:
            return new AppError(kind, message ?? "", retryAfterSeconds);
        default:
            return new AppError(ApiErrorKind.INTERNAL, message ?? "");
    }
}

export function getAppErrorHandler(defaultMessage: string, toastId?: string) {
    return (error: Error) => handleAppError(error, defaultMessage, toastId);
}

/**
 * Shows an error. Only an error carrying wording meant for the user shows its
 * own message; anything else — including every rejected request — gets
 * `defaultMessage`, which the caller writes for its own context.
 */
export function handleAppError(
    error: Error,
    defaultMessage: string,
    toastKey?: string
) {
    if (error instanceof AppError) {
        switch (error.kind) {
            case ApiErrorKind.HANDLED:
                showErrorToast(error.message, toastKey);
                return;
            case ApiErrorKind.NOTICE:
                showInfoToast(error.message, toastKey);
                return;
            case ApiErrorKind.INTERNAL:
                break;
        }
    }
    showErrorToast(defaultMessage, toastKey);
}
