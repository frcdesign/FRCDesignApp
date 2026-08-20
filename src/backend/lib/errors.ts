import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";
import { OnshapeRateLimitError } from "./onshape/client";
import type { AppContextEnv } from "./context";

export const errorHandler: ErrorHandler<AppContextEnv> = (err, c) => {
    // Surface an Onshape rate limit as a 429 the client can retry, rather
    // than blocking the request thread waiting it out.
    if (err instanceof OnshapeRateLimitError) {
        return c.json(
            {
                error: "Onshape rate limit reached. Please try again shortly.",
                retryAfterSeconds: err.retryAfterSeconds
            },
            HttpStatus.TOO_MANY_REQUESTS
        );
    }
    if (err instanceof HTTPException) {
        return err.getResponse();
    }
    console.error(err);
    return c.json(
        { error: "Internal Server Error" },
        HttpStatus.INTERNAL_SERVER_ERROR
    );
};
