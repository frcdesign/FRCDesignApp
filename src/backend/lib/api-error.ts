/**
 * The one shape every failed /api response takes; `kind` tells the client what
 * to do about it. A leaf module the frontend imports.
 */
import { HttpStatus } from "http-status-ts";

export enum ApiErrorKind {
    /** `message` is written for the user; show it. */
    HANDLED = "handled",
    /** No usable Onshape session: the client can offer to sign in again. */
    SIGN_IN_REQUIRED = "sign-in-required",
    /** Signed in, but this caller is not allowed to do it. */
    FORBIDDEN = "forbidden",
    /** `message` is for the logs. The client shows its own wording instead. */
    INTERNAL = "internal"
}

interface ApiErrorOf<K extends ApiErrorKind> {
    kind: K;
    message: string;
}

export type ApiErrorBody =
    | ApiErrorOf<ApiErrorKind.HANDLED>
    | ApiErrorOf<ApiErrorKind.SIGN_IN_REQUIRED>
    | ApiErrorOf<ApiErrorKind.FORBIDDEN>
    | ApiErrorOf<ApiErrorKind.INTERNAL>;

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

/** The caller has no session Onshape accepts; the client can offer them one. */
export function signInRequiredError(message: string): ApiError {
    return new ApiError(
        { kind: ApiErrorKind.SIGN_IN_REQUIRED, message },
        HttpStatus.UNAUTHORIZED
    );
}

/** The caller is known, and this is not theirs to do. */
export function forbiddenError(message: string): ApiError {
    return new ApiError(
        { kind: ApiErrorKind.FORBIDDEN, message },
        HttpStatus.FORBIDDEN
    );
}
