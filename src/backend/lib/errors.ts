import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import { OnshapeApiError, OnshapeRateLimitError } from "./onshape/client";
import {
    ApiError,
    ApiErrorKind,
    forbiddenError,
    handledError,
    internalError,
    signInRequiredError
} from "./api-error";
import type { AppContextEnv } from "./context";

/**
 * What we are willing to say about an Onshape failure. Anything not named here
 * is ours to explain, not Onshape's, so it stays generic.
 */
function fromOnshapeError(error: OnshapeApiError): ApiError {
    if (error instanceof OnshapeRateLimitError) {
        return handledError(
            "Onshape rate limit reached. Please try again later.",
            HttpStatus.TOO_MANY_REQUESTS
        );
    }
    if (error.status === HttpStatus.UNAUTHORIZED) {
        return signInRequiredError(
            "Onshape did not accept the session. Try signing in again."
        );
    }
    if (error.status === HttpStatus.FORBIDDEN) {
        return forbiddenError(
            "Onshape rejected the operation. Make sure you have access to this document and you're signed in to the correct Onshape enterprise."
        );
    }
    return internalError(
        `Onshape request failed: ${error.message}`,
        HttpStatus.BAD_GATEWAY
    );
}

export const errorHandler: ErrorHandler<AppContextEnv> = (err, c) => {
    if (err instanceof ApiError) {
        return c.json(err.body, err.status);
    }
    if (err instanceof OnshapeApiError) {
        const apiError = fromOnshapeError(err);
        if (apiError.body.kind === ApiErrorKind.INTERNAL) {
            console.error(err);
        }
        return c.json(apiError.body, apiError.status);
    }
    // A raw HTTPException is a validator rejecting a malformed request, which
    // is our bug rather than something the user can act on.
    if (err instanceof HTTPException) {
        console.error(err);
        return c.json(
            { kind: ApiErrorKind.INTERNAL, message: err.message },
            err.status
        );
    }
    console.error(err);
    return c.json(
        { kind: ApiErrorKind.INTERNAL, message: "Internal Server Error" },
        HttpStatus.INTERNAL_SERVER_ERROR
    );
};
