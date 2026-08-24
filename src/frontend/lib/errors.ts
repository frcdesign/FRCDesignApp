import { ApiErrorKind, type ApiErrorBody } from "@backend/lib/api-error";
import { showErrorToast } from "./notifications";

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

/** Builds an {@link AppError} from a failed /api response body. */
export function fromApiErrorBody(body: unknown): AppError {
    const parsed = body as Partial<ApiErrorBody> | undefined;
    switch (parsed?.kind) {
        case ApiErrorKind.HANDLED:
            return new AppError({
                kind: ApiErrorKind.HANDLED,
                message: parsed.message ?? ""
            });
        case ApiErrorKind.RATE_LIMITED:
            return new AppError({
                kind: ApiErrorKind.RATE_LIMITED,
                message: parsed.message ?? "",
                retryAfterSeconds: parsed.retryAfterSeconds ?? 0
            });
        default:
            return new AppError({
                kind: ApiErrorKind.INTERNAL,
                message: parsed?.message ?? ""
            });
    }
}

export function getAppErrorHandler(defaultMessage: string, toastId?: string) {
    return (error: Error) => handleAppError(error, defaultMessage, toastId);
}

/**
 * Only an error carrying wording meant for the user shows its own message;
 * anything else gets `defaultMessage`, written for the caller's context.
 */
export function handleAppError(
    error: Error,
    defaultMessage: string,
    toastKey?: string
) {
    if (error instanceof AppError) {
        switch (error.body.kind) {
            case ApiErrorKind.HANDLED:
            case ApiErrorKind.RATE_LIMITED:
                showErrorToast(error.body.message, toastKey);
                return;
            case ApiErrorKind.INTERNAL:
                break;
        }
    }
    showErrorToast(defaultMessage, toastKey);
}
