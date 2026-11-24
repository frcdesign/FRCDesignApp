import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import {
    OnshapeApiError,
    OnshapeRateLimitError,
    OnshapeTimeoutError
} from "./onshape/client";
import { OnshapeFailure, rateLimitedMessage } from "./onshape/failures";
import {
    ApiError,
    ApiErrorKind,
    forbiddenError,
    internalError,
    rateLimitedError,
    signInRequiredError
} from "./api-error";
import type { AppContext, AppContextEnv } from "./context";
import { describeError } from "./error-text";

/** The Ray ID, which Workers Logs filters on, so a report quoting it finds the stack; tests and local dev have none. */
function logServerError(c: AppContext, error: unknown): string {
    const errorId = c.req.header("cf-ray") ?? crypto.randomUUID();
    console.error(`Server error ${errorId}: ${describeError(error)}`, error);
    return errorId;
}

/** Anything not named here stays generic. */
function fromOnshapeError(error: OnshapeApiError): ApiError {
    if (error instanceof OnshapeRateLimitError) {
        return rateLimitedError(
            rateLimitedMessage(error.retryAfterSeconds),
            error.retryAfterSeconds
        );
    }
    if (error.status === HttpStatus.UNAUTHORIZED) {
        return signInRequiredError(OnshapeFailure.SIGN_IN_EXPIRED);
    }
    if (error.status === HttpStatus.FORBIDDEN) {
        return forbiddenError(OnshapeFailure.FORBIDDEN);
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
        if (apiError.body.kind !== ApiErrorKind.INTERNAL) {
            // The user reads our wording; Onshape's own reason is only here, under the id a report quotes.
            const errorId = c.req.header("cf-ray") ?? crypto.randomUUID();
            console.warn(
                `Onshape refused ${c.req.method} ${c.req.path} (${errorId}): ${describeError(err)}`
            );
            return c.json({ ...apiError.body, errorId }, apiError.status);
        }
        return c.json(
            { ...apiError.body, errorId: logServerError(c, err) },
            apiError.status
        );
    }
    // Said as itself, so a report can tell Onshape being slow from our own failure.
    if (err instanceof OnshapeTimeoutError) {
        return c.json(
            {
                kind: ApiErrorKind.INTERNAL,
                message: err.message,
                errorId: logServerError(c, err)
            },
            HttpStatus.GATEWAY_TIMEOUT
        );
    }
    // A validator rejecting a malformed request: our bug, not the user's.
    if (err instanceof HTTPException) {
        return c.json(
            {
                kind: ApiErrorKind.INTERNAL,
                message: err.message,
                errorId: logServerError(c, err)
            },
            err.status
        );
    }
    return c.json(
        {
            kind: ApiErrorKind.INTERNAL,
            message: "Internal Server Error",
            errorId: logServerError(c, err)
        },
        HttpStatus.INTERNAL_SERVER_ERROR
    );
};
