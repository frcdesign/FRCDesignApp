import { DrizzleQueryError } from "drizzle-orm";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import { runInBackground } from "./background";
import { kvStore } from "./kv-store";
import { OnshapeApiError, OnshapeRateLimitError } from "./onshape/client";
import {
    ApiError,
    ApiErrorKind,
    forbiddenError,
    handledError,
    internalError,
    signInRequiredError
} from "./api-error";
import type { AppContext, AppContextEnv } from "./context";

/** Long enough for a report sent after the crash page sat open overnight. */
const SERVER_ERROR_TTL_SECONDS = 24 * 60 * 60;
const MAX_CAUSES = 4;
const MAX_FRAMES = 10;
const MAX_SERVER_ERROR = 2000;

/** A logged error as a report quotes it, by the `errorId` its response carried. */
const serverErrors = kvStore<string>("server-error", {
    ttlSeconds: SERVER_ERROR_TTL_SECONDS
});

export function findServerError(
    kv: KVNamespace,
    errorId: string
): Promise<string | undefined> {
    return serverErrors.get(kv, errorId);
}

function summarize(error: Error): string {
    // Drizzle spells the query's params, user ids among them, into its message.
    if (error instanceof DrizzleQueryError) {
        return `DrizzleQueryError: Failed query: ${error.query}`;
    }
    return `${error.name}: ${error.message}`;
}

/** The error and its causes, then where it was thrown. */
export function describeServerError(error: unknown): string {
    const lines: string[] = [];
    let current = error;
    for (let depth = 0; current !== undefined && depth < MAX_CAUSES; depth++) {
        const prefix = depth === 0 ? "" : "cause: ";
        if (!(current instanceof Error)) {
            lines.push(
                prefix +
                    (typeof current === "string"
                        ? current
                        : `a thrown ${typeof current}`)
            );
            break;
        }
        lines.push(prefix + summarize(current));
        current = current.cause;
    }
    // Only the frames: the stack's first lines repeat the message.
    const frames = (error instanceof Error ? (error.stack ?? "") : "")
        .split("\n")
        .filter((line) => /^\s+at /.test(line))
        .slice(0, MAX_FRAMES);
    return [...lines, ...frames].join("\n").slice(0, MAX_SERVER_ERROR);
}

/** Keyed by the Ray ID, which Workers Logs can filter on; tests and local dev have none. */
async function logServerError(c: AppContext, error: unknown): Promise<string> {
    const errorId = c.req.header("cf-ray") ?? crypto.randomUUID();
    console.error(`Server error ${errorId}`, error);
    await runInBackground(c, "store a server error", () =>
        serverErrors.put(c.env.KV, errorId, describeServerError(error))
    );
    return errorId;
}

/** Anything not named here stays generic. */
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

export const errorHandler: ErrorHandler<AppContextEnv> = async (err, c) => {
    if (err instanceof ApiError) {
        return c.json(err.body, err.status);
    }
    if (err instanceof OnshapeApiError) {
        const apiError = fromOnshapeError(err);
        if (apiError.body.kind !== ApiErrorKind.INTERNAL) {
            return c.json(apiError.body, apiError.status);
        }
        return c.json(
            { ...apiError.body, errorId: await logServerError(c, err) },
            apiError.status
        );
    }
    // A validator rejecting a malformed request: our bug, not the user's.
    if (err instanceof HTTPException) {
        return c.json(
            {
                kind: ApiErrorKind.INTERNAL,
                message: err.message,
                errorId: await logServerError(c, err)
            },
            err.status
        );
    }
    return c.json(
        {
            kind: ApiErrorKind.INTERNAL,
            message: "Internal Server Error",
            errorId: await logServerError(c, err)
        },
        HttpStatus.INTERNAL_SERVER_ERROR
    );
};
