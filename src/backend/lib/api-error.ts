/**
 * The one shape every failed /api response takes; `kind` tells the client what
 * to do and carries what that kind needs. A leaf module the frontend imports.
 */

export enum ApiErrorKind {
    /** `message` is written for the user; show it. */
    HANDLED = "handled",
    /** Onshape is rate limiting us, and said how long to wait. */
    RATE_LIMITED = "rate-limited",
    /** `message` is for the logs. The client shows its own wording instead. */
    INTERNAL = "internal"
}

interface ApiErrorOf<K extends ApiErrorKind> {
    kind: K;
    message: string;
}

export type ApiErrorBody =
    | ApiErrorOf<ApiErrorKind.HANDLED>
    | ApiErrorOf<ApiErrorKind.INTERNAL>
    | (ApiErrorOf<ApiErrorKind.RATE_LIMITED> & { retryAfterSeconds: number });

/** Thrown by a route; the app's error handler turns it into the response. */
export class ApiError extends Error {
    constructor(
        readonly body: ApiErrorBody,
        readonly status: number
    ) {
        super(body.message);
        this.name = "ApiError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** The wording reaches the user, so write it for them. */
export function handledError(message: string, status: number): ApiError {
    return new ApiError({ kind: ApiErrorKind.HANDLED, message }, status);
}

/** The client will show its own wording; this text is only for the logs. */
export function internalError(message: string, status: number): ApiError {
    return new ApiError({ kind: ApiErrorKind.INTERNAL, message }, status);
}

export function rateLimitedError(
    message: string,
    status: number,
    retryAfterSeconds: number
): ApiError {
    return new ApiError(
        { kind: ApiErrorKind.RATE_LIMITED, message, retryAfterSeconds },
        status
    );
}
