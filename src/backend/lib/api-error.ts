/**
 * The one shape every failed /api response takes. `kind` tells the client what
 * to do with `message`, so it can handle an error it has never heard of.
 *
 * A leaf module: the frontend imports the kind and the body to switch on them.
 */

export enum ApiErrorKind {
    /** `message` is written for the user; show it as the failure. */
    HANDLED = "handled",
    /** `message` is written for the user, but nothing went wrong. */
    NOTICE = "notice",
    /** `message` is for us. The client shows its own wording instead. */
    INTERNAL = "internal"
}

export interface ApiErrorBody {
    kind: ApiErrorKind;
    message: string;
    /** Only on an Onshape rate limit: how long it asked us to wait. */
    retryAfterSeconds?: number;
}

/** Thrown by a route; the app's error handler turns it into the response. */
export class ApiError extends Error {
    constructor(
        readonly kind: ApiErrorKind,
        message: string,
        readonly status: number,
        readonly retryAfterSeconds?: number
    ) {
        super(message);
        this.name = "ApiError";
        Object.setPrototypeOf(this, new.target.prototype);
    }

    get body(): ApiErrorBody {
        return {
            kind: this.kind,
            message: this.message,
            retryAfterSeconds: this.retryAfterSeconds
        };
    }
}

/** The wording reaches the user, so write it for them. */
export function handledError(message: string, status: number): ApiError {
    return new ApiError(ApiErrorKind.HANDLED, message, status);
}

/** Same, for an outcome that is worth saying but is not a failure. */
export function noticeError(message: string, status: number): ApiError {
    return new ApiError(ApiErrorKind.NOTICE, message, status);
}

/** The client will show its own wording; this text is only for the logs. */
export function internalError(message: string, status: number): ApiError {
    return new ApiError(ApiErrorKind.INTERNAL, message, status);
}
